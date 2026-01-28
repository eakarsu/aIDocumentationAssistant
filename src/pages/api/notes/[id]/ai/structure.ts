import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';
import { structureNote } from '@/lib/ai-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

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

    const templateSections = note.template?.sections || [];
    const structuredContent = await structureNote(transcription, templateSections as object[]);

    // Update note with structured content
    await prisma.note.update({
      where: { id: id as string },
      data: {
        content: structuredContent,
        aiTranscription: transcription,
      },
    });

    await createAuditLog(user.id, 'UPDATE', 'Note', id as string, null, { aiAction: 'structure' }, req);

    res.status(200).json({ content: structuredContent });
  } catch (error) {
    console.error('AI structure error:', error);
    res.status(500).json({ error: 'Failed to structure note' });
  }
}
