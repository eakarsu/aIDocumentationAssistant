import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const doc = await prisma.doc.findUnique({
      where: { id: id as string },
      include: { collaborators: true },
    });

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check publish permissions
    const canPublish =
      user.role === 'ADMIN' ||
      doc.authorId === user.id ||
      doc.collaborators.some(c => c.userId === user.id && c.permission === 'ADMIN');

    if (!canPublish) {
      return res.status(403).json({ error: 'No permission to publish' });
    }

    const { visibility = 'PUBLIC' } = req.body;

    const updatedDoc = await prisma.doc.update({
      where: { id: id as string },
      data: {
        status: 'PUBLISHED',
        visibility,
        publishedAt: doc.publishedAt || new Date(),
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        category: true,
      },
    });

    await createAuditLog(user.id, 'UPDATE', 'Doc', id as string, doc, updatedDoc, req);

    res.status(200).json(updatedDoc);
  } catch (error) {
    console.error('Publish doc error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
