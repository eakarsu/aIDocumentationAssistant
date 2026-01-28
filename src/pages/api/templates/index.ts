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
      const { noteType, specialty, isSystem, search } = req.query;

      const where: any = { isActive: true };

      if (noteType) {
        where.noteType = noteType;
      }

      if (specialty) {
        where.specialty = specialty;
      }

      if (isSystem !== undefined) {
        where.isSystem = isSystem === 'true';
      }

      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      // Show system templates and user's own templates
      where.OR = [
        { isSystem: true },
        { creatorId: user.id },
      ];

      const templates = await prisma.noteTemplate.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          customSections: {
            orderBy: { orderIndex: 'asc' },
          },
        },
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      });

      res.status(200).json(templates);
    } catch (error) {
      console.error('Get templates error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    try {
      const { name, description, noteType, specialty, sections, defaultValues } = req.body;

      if (!name || !noteType || !sections) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const template = await prisma.noteTemplate.create({
        data: {
          name,
          description,
          noteType,
          specialty,
          sections,
          defaultValues,
          creatorId: user.id,
          isSystem: false,
        },
      });

      await createAuditLog(user.id, 'CREATE', 'NoteTemplate', template.id, null, template, req);

      res.status(201).json(template);
    } catch (error) {
      console.error('Create template error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
