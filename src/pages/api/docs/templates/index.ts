import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const { type, search } = req.query;

      const where: any = {
        isActive: true,
        OR: [
          { isSystem: true },
          { creatorId: user.id }
        ]
      };

      if (user.role === 'ADMIN') {
        delete where.OR;
      }

      if (type) {
        where.type = type;
      }

      if (search) {
        where.AND = [
          {
            OR: [
              { name: { contains: search as string, mode: 'insensitive' } },
              { description: { contains: search as string, mode: 'insensitive' } }
            ]
          }
        ];
      }

      const templates = await prisma.docTemplate.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              docs: true,
            },
          },
        },
        orderBy: [
          { isSystem: 'desc' },
          { name: 'asc' }
        ],
      });

      res.status(200).json(templates);
    } catch (error) {
      console.error('Get templates error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    try {
      const { name, description, type, content, structure } = req.body;

      if (!name || !type || !content) {
        return res.status(400).json({ error: 'Name, type, and content are required' });
      }

      const template = await prisma.docTemplate.create({
        data: {
          name,
          description,
          type,
          content,
          structure,
          creatorId: user.id,
          isSystem: false,
        },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      await createAuditLog(user.id, 'CREATE', 'DocTemplate', template.id, null, template, req);

      res.status(201).json(template);
    } catch (error) {
      console.error('Create template error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
