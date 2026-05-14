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

    // Check if file exists
    if (!fs.existsSync(recording.filePath)) {
      return res.status(400).json({
        error: 'Audio file not found. This may be demo data without an actual recording file.',
        hint: 'Create a new recording using the "Start Recording" button to test transcription.'
      });
    }

    // Update status
    await prisma.recording.update({
      where: { id: id as string },
      data: { status: 'TRANSCRIBING' },
    });

    // Read file and transcribe
    const audioBuffer = fs.readFileSync(recording.filePath);
    const result = await transcribeAudio(audioBuffer, recording.mimeType);

    // Update recording with transcription
    const updatedRecording = await prisma.recording.update({
      where: { id: id as string },
      data: {
        status: 'COMPLETED',
        transcription: result.text,
        medicalTerms: result.medicalTerms,
        processedAt: new Date(),
      },
    });

    // If linked to a note, update the note with transcription
    if (recording.noteId) {
      await prisma.note.update({
        where: { id: recording.noteId },
        data: {
          aiTranscription: result.text,
        },
      });
    }

    await createAuditLog(user.id, 'UPDATE', 'Recording', id as string, null, { action: 'transcribe' }, req);

    res.status(200).json({
      transcription: result.text,
      medicalTerms: result.medicalTerms,
    });
  } catch (error) {
    console.error('Transcribe error:', error);

    // Update status to failed
    await prisma.recording.update({
      where: { id: id as string },
      data: { status: 'FAILED' },
    });

    res.status(500).json({ error: 'Failed to transcribe recording' });
  }
}
