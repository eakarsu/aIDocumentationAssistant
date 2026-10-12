import {withAiRequest,aiFailureStatus} from '@/lib/ai-request';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';
import { performQualityCheck } from '@/lib/ai-service';
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

  try {
    const note = await prisma.note.findUnique({
      where: { id: id as string },
      include:{coSignatures:{select:{signerId:true}}},
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    if(user.role!=='ADMIN'&&note.authorId!==user.id&&!note.coSignatures.some(signature=>signature.signerId===user.id))return res.status(403).json({error:'Access denied'});
    await withAiRequest(req,res,async signal=>{

    const result = await performQualityCheck(note.content as object, note.noteType,signal);

    // Update note with quality score
    await prisma.$transaction(async tx=>{signal.throwIfAborted();await tx.note.update({
      where: { id: id as string },
      data: {
        aiQualityScore: result.score,
        aiResults: {
          ...(note.aiResults && typeof note.aiResults === 'object' && !Array.isArray(note.aiResults) ? note.aiResults : {}),
          quality: result,
        } as any,
      },
    });signal.throwIfAborted();});

    signal.throwIfAborted();await createAuditLog(user.id, 'UPDATE', 'Note', id as string, null, { aiAction: 'quality_check' }, req);

    signal.throwIfAborted();res.status(200).json(result);
    });
  } catch (error) {
    if(!res.destroyed&&!res.writableEnded)res.status(aiFailureStatus(error)).json({error:error instanceof Error?error.message:'AI provider failed'});
  }
}
