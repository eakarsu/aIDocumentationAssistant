import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { type, ids, data } = req.body;

  if (!type || !ids || !Array.isArray(ids) || ids.length === 0 || !data) {
    return res.status(400).json({ error: 'Type, a non-empty array of IDs, and data are required' });
  }

  if (ids.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 items per bulk operation' });
  }

  try {
    let updatedCount = 0;

    switch (type) {
      case 'notes': {
        const allowedFields: Record<string, boolean> = { status: true };
        const updateData: any = {};
        for (const [key, value] of Object.entries(data)) {
          if (allowedFields[key]) updateData[key] = value;
        }
        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ error: 'No valid fields to update. Allowed: status' });
        }
        const where: any = { id: { in: ids } };
        if (user.role !== 'ADMIN') {
          where.authorId = user.id;
        }
        const result = await prisma.note.updateMany({ where, data: updateData });
        updatedCount = result.count;
        break;
      }
      case 'users': {
        if (user.role !== 'ADMIN') {
          return res.status(403).json({ error: 'Only admins can bulk update users' });
        }
        const allowedFields: Record<string, boolean> = { role: true, isActive: true };
        const updateData: any = {};
        for (const [key, value] of Object.entries(data)) {
          if (allowedFields[key]) updateData[key] = value;
        }
        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ error: 'No valid fields to update. Allowed: role, isActive' });
        }
        const result = await prisma.user.updateMany({ where: { id: { in: ids } }, data: updateData });
        updatedCount = result.count;
        break;
      }
      case 'docs': {
        const allowedFields: Record<string, boolean> = { status: true, visibility: true };
        const updateData: any = {};
        for (const [key, value] of Object.entries(data)) {
          if (allowedFields[key]) updateData[key] = value;
        }
        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ error: 'No valid fields to update. Allowed: status, visibility' });
        }
        const where: any = { id: { in: ids } };
        if (user.role !== 'ADMIN') {
          where.authorId = user.id;
        }
        const result = await prisma.doc.updateMany({ where, data: updateData });
        updatedCount = result.count;
        break;
      }
      default:
        return res.status(400).json({ error: 'Invalid type. Use: notes, users, docs' });
    }

    await createAuditLog(user.id, 'UPDATE', type, 'bulk-update', null, { ids, data, updatedCount }, req);

    res.status(200).json({ message: `Successfully updated ${updatedCount} items`, updatedCount });
  } catch (error: any) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Bulk update failed' });
  }
}
