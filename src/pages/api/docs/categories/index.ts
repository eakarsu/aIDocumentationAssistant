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
      const { parentId, flat } = req.query;

      const where: any = {};

      if (flat !== 'true') {
        where.parentId = parentId || null;
      }

      const categories = await prisma.docCategory.findMany({
        where,
        include: {
          parent: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          children: flat !== 'true' ? {
            include: {
              children: {
                include: {
                  _count: {
                    select: { docs: true },
                  },
                },
              },
              _count: {
                select: { docs: true },
              },
            },
          } : false,
          _count: {
            select: { docs: true },
          },
        },
        orderBy: { orderIndex: 'asc' },
      });

      res.status(200).json(categories);
    } catch (error) {
      console.error('Get categories error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    try {
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { name, description, icon, color, parentId, orderIndex = 0 } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      // Generate unique slug
      let baseSlug = slugify(name, { lower: true, strict: true });
      let slug = baseSlug;
      let counter = 1;

      while (await prisma.docCategory.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      const category = await prisma.docCategory.create({
        data: {
          name,
          slug,
          description,
          icon,
          color,
          parentId,
          orderIndex,
        },
        include: {
          parent: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: { docs: true },
          },
        },
      });

      await createAuditLog(user.id, 'CREATE', 'DocCategory', category.id, null, category, req);

      res.status(201).json(category);
    } catch (error) {
      console.error('Create category error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
