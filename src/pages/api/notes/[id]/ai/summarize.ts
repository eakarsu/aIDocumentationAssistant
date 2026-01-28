import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';
import { generateSummary } from '@/lib/ai-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;

  try {
    const note = await prisma.note.findUnique({
      where: { id: id as string },
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const result = await generateSummary(note.content as object);

    // Update note with AI summary
    await prisma.note.update({
      where: { id: id as string },
      data: {
        aiSummary: result.summary,
        aiFollowUps: result.followUps,
      },
    });

    await createAuditLog(user.id, 'UPDATE', 'Note', id as string, null, { aiAction: 'summarize' }, req);

    res.status(200).json(result);
  } catch (error) {
    console.error('AI summarize error:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
}
