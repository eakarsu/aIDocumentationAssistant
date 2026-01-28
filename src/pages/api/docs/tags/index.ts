import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';
import slugify from 'slugify';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const { search, limit = '50' } = req.query;

      const where: any = {};

      if (search) {
        where.name = {
          contains: search as string,
          mode: 'insensitive',
        };
      }

      const tags = await prisma.docTag.findMany({
        where,
        include: {
          _count: {
            select: { docs: true },
          },
        },
        orderBy: [
          { docs: { _count: 'desc' } },
          { name: 'asc' },
        ],
        take: parseInt(limit as string),
      });

      res.status(200).json(tags);
    } catch (error) {
      console.error('Get tags error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    try {
      const { name, color } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const slug = slugify(name, { lower: true, strict: true });

      // Check if tag already exists
      const existing = await prisma.docTag.findUnique({ where: { slug } });
      if (existing) {
        return res.status(200).json(existing);
      }

      const tag = await prisma.docTag.create({
        data: {
          name,
          slug,
          color,
        },
      });

      await createAuditLog(user.id, 'CREATE', 'DocTag', tag.id, null, tag, req);

      res.status(201).json(tag);
    } catch (error) {
      console.error('Create tag error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    try {
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { tagId } = req.body;

      if (!tagId) {
        return res.status(400).json({ error: 'Tag ID is required' });
      }

      const tag = await prisma.docTag.findUnique({
        where: { id: tagId },
      });

      if (!tag) {
        return res.status(404).json({ error: 'Tag not found' });
      }

      await prisma.docTag.delete({
        where: { id: tagId },
      });

      await createAuditLog(user.id, 'DELETE', 'DocTag', tagId, tag, null, req);

      res.status(200).json({ message: 'Tag deleted successfully' });
    } catch (error) {
      console.error('Delete tag error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
