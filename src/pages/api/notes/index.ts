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
      const {
        status,
        noteType,
        patientId,
        authorId,
        startDate,
        endDate,
        search,
        page = '1',
        limit = '20'
      } = req.query;

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

      const where: any = {};

      // Non-admins can only see their own notes or notes they have access to
      if (user.role !== 'ADMIN') {
        where.authorId = user.id;
      }

      if (status) {
        where.status = status;
      }

      if (noteType) {
        where.noteType = noteType;
      }

      if (patientId) {
        where.patientId = patientId;
      }

      if (authorId && user.role === 'ADMIN') {
        where.authorId = authorId;
      }

      if (startDate || endDate) {
        where.encounterDate = {};
        if (startDate) where.encounterDate.gte = new Date(startDate as string);
        if (endDate) where.encounterDate.lte = new Date(endDate as string);
      }

      if (search) {
        where.OR = [
          { patientName: { contains: search as string, mode: 'insensitive' } },
          { patientId: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const [notes, total] = await Promise.all([
        prisma.note.findMany({
          where,
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                specialty: true,
              },
            },
            template: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                comments: true,
                amendments: true,
                recordings: true,
              },
            },
          },
          skip,
          take: parseInt(limit as string),
          orderBy: { encounterDate: 'desc' },
        }),
        prisma.note.count({ where }),
      ]);

      await createAuditLog(user.id, 'READ', 'Note', 'list', null, null, req);

      res.status(200).json({
        notes,
        pagination: {
          total,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          totalPages: Math.ceil(total / parseInt(limit as string)),
        },
      });
    } catch (error) {
      console.error('Get notes error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    try {
      const {
        patientId,
        patientName,
        encounterDate,
        noteType,
        templateId,
        content,
        sections
      } = req.body;

      if (!patientId || !patientName || !encounterDate || !noteType) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const note = await prisma.note.create({
        data: {
          patientId,
          patientName,
          encounterDate: new Date(encounterDate),
          noteType,
          templateId,
          content: content || {},
          sections: sections || null,
          authorId: user.id,
          status: 'DRAFT',
        },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          template: {
            select: {
              id: true,
              name: true,
              sections: true,
            },
          },
        },
      });

      // Create initial version
      await prisma.noteVersion.create({
        data: {
          noteId: note.id,
          version: 1,
          content: note.content as object,
          sections: note.sections as object || undefined,
          changedBy: user.id,
          changeLog: 'Initial creation',
        },
      });

      await createAuditLog(user.id, 'CREATE', 'Note', note.id, null, note, req);

      res.status(201).json(note);
    } catch (error) {
      console.error('Create note error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
