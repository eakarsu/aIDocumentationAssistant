import {withAiRequest,aiFailureStatus} from '@/lib/ai-request';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';
import { transcribeAudio, extractMedicalTerms } from '@/lib/ai-service';
import { rateLimit } from '@/lib/rate-limit';
import fs from 'fs';

const aiRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 20 });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const allowed = await aiRateLimit(req, res);
  if (!allowed) return;

  const { id } = req.query;

  try {
    const recording = await prisma.recording.findUnique({
      where: { id: id as string },
    });

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    if (recording.userId !== user.id && user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const linkedNote=recording.noteId?await prisma.note.findUnique({where:{id:recording.noteId}}):null;
    if(linkedNote&&user.role!=='ADMIN'&&linkedNote.authorId!==user.id)return res.status(403).json({error:'Only the note author or administrator can attach a transcription'});
    if(linkedNote&&linkedNote.status!=='DRAFT')return res.status(409).json({error:'A transcription can only be attached to an unsigned draft'});
    if(recording.status==='TRANSCRIBING')return res.status(409).json({error:'This recording is already being transcribed'});

    // Check if file exists
    if (!fs.existsSync(recording.filePath)) {
      return res.status(400).json({
        error: 'Audio file not found. This may be demo data without an actual recording file.',
        hint: 'Create a new recording using the "Start Recording" button to test transcription.'
      });
    }

    await withAiRequest(req,res,async signal=>{
    // Update status
    await prisma.recording.update({
      where: { id: id as string },
      data: { status: 'TRANSCRIBING' },
    });

    // Read file and transcribe
    const audioBuffer = fs.readFileSync(recording.filePath);
    const result = await transcribeAudio(audioBuffer, recording.mimeType,signal);

    // Update recording with transcription
    await prisma.$transaction(async tx=>{signal.throwIfAborted();await tx.recording.update({
      where: { id: id as string },
      data: {
        status: 'COMPLETED',
        transcription: result.text,
        medicalTerms: result.medicalTerms,
        processedAt: new Date(),
      },
    });

    // If linked to a note, update the note with transcription
    if (linkedNote) {
      const saved=await tx.note.updateMany({
        where: { id: linkedNote.id, status:'DRAFT',updatedAt:linkedNote.updatedAt },
        data: {
          aiTranscription: result.text,
        },
      });
      if(saved.count!==1)throw Object.assign(new Error('The draft changed during transcription. Review it before attaching the transcript.'),{status:409});
    }

    signal.throwIfAborted();});
    signal.throwIfAborted();await createAuditLog(user.id, 'UPDATE', 'Recording', id as string, null, { action: 'transcribe' }, req);

    signal.throwIfAborted();res.status(200).json({
      transcription: result.text,
      medicalTerms: result.medicalTerms,
    });
    });
  } catch (error) {
    // Update status to failed
    await prisma.recording.update({
      where: { id: id as string },
      data: { status: 'FAILED' },
    });

    if(!res.destroyed&&!res.writableEnded)res.status(aiFailureStatus(error)).json({ error: error instanceof Error ? error.message : 'Failed to transcribe recording' });
  }
}
