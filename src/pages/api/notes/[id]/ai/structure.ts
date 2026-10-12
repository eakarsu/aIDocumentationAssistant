import {withAiRequest,aiFailureStatus} from '@/lib/ai-request';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';
import { structureNote } from '@/lib/ai-service';
import { rateLimit } from '@/lib/rate-limit';

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
  const { transcription } = req.body;

  if (!transcription) {
    return res.status(400).json({ error: 'Transcription is required' });
  }

  try {
    const note = await prisma.note.findUnique({
      where: { id: id as string },
      include: { template: true },
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    if(user.role!=='ADMIN'&&note.authorId!==user.id)return res.status(403).json({error:'Only the author or administrator can structure this note'});
    if(note.status!=='DRAFT')return res.status(409).json({error:'Only an unsigned draft can be structured'});
    await withAiRequest(req,res,async signal=>{
    const templateSections = note.template?.sections || [];
    const structuredContent = await structureNote(transcription, templateSections as object[],signal);

    // Update note with structured content
    await prisma.$transaction(async tx=>{signal.throwIfAborted();const saved=await tx.note.updateMany({
      where: { id: id as string, status:'DRAFT', updatedAt:note.updatedAt },
      data: {
        content: structuredContent,
        aiTranscription: transcription,
      },
    });if(saved.count!==1)throw Object.assign(new Error('The draft changed while AI was running. Review it before generating again.'),{status:409});signal.throwIfAborted();});

    signal.throwIfAborted();await createAuditLog(user.id, 'UPDATE', 'Note', id as string, null, { aiAction: 'structure' }, req);

    signal.throwIfAborted();res.status(200).json({ content: structuredContent });
    });
  } catch (error) {
    if(!res.destroyed&&!res.writableEnded)res.status(aiFailureStatus(error)).json({error:error instanceof Error?error.message:'AI provider failed'});
  }
}
