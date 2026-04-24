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

  const { type, ids } = req.body;

  if (!type || !ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Type and a non-empty array of IDs are required' });
  }

  if (ids.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 items per bulk operation' });
  }

  try {
    let deletedCount = 0;

    switch (type) {
      case 'notes': {
        const where: any = { id: { in: ids } };
        if (user.role !== 'ADMIN') {
          where.authorId = user.id;
        }
        const result = await prisma.note.deleteMany({ where });
        deletedCount = result.count;
        break;
      }
      case 'users': {
        if (user.role !== 'ADMIN') {
          return res.status(403).json({ error: 'Only admins can bulk delete users' });
        }
        const filteredIds = ids.filter((id: string) => id !== user.id);
        if (filteredIds.length === 0) {
          return res.status(400).json({ error: 'Cannot delete your own account' });
        }
        const result = await prisma.user.deleteMany({ where: { id: { in: filteredIds } } });
        deletedCount = result.count;
        break;
      }
      case 'recordings': {
        const where: any = { id: { in: ids } };
        if (user.role !== 'ADMIN') {
          where.userId = user.id;
        }
        const result = await prisma.recording.deleteMany({ where });
        deletedCount = result.count;
        break;
      }
      case 'docs': {
        const where: any = { id: { in: ids } };
        if (user.role !== 'ADMIN') {
          where.authorId = user.id;
        }
        const result = await prisma.doc.deleteMany({ where });
        deletedCount = result.count;
        break;
      }
      default:
        return res.status(400).json({ error: 'Invalid type. Use: notes, users, recordings, docs' });
    }

    await createAuditLog(user.id, 'DELETE', type, 'bulk-delete', null, { ids, deletedCount }, req);

    res.status(200).json({ message: `Successfully deleted ${deletedCount} items`, deletedCount });
  } catch (error: any) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Bulk delete failed' });
  }
}
