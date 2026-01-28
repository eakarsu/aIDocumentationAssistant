import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';

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

    if (note.authorId !== user.id) {
      return res.status(403).json({ error: 'Only the author can sign the note' });
    }

    if (note.status === 'SIGNED' || note.status === 'LOCKED') {
      return res.status(400).json({ error: 'Note is already signed' });
    }

    const updatedNote = await prisma.note.update({
      where: { id: id as string },
      data: {
        status: 'SIGNED',
        signedAt: new Date(),
      },
    });

    await createAuditLog(user.id, 'SIGN', 'Note', id as string, { status: note.status }, { status: 'SIGNED' }, req);

    res.status(200).json(updatedNote);
  } catch (error) {
    console.error('Sign note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
