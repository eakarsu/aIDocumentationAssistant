import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const template = await prisma.noteTemplate.findUnique({
        where: { id: id as string },
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
      });

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      res.status(200).json(template);
    } catch (error) {
      console.error('Get template error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    try {
      const template = await prisma.noteTemplate.findUnique({
        where: { id: id as string },
      });

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Cannot edit system templates unless admin
      if (template.isSystem && user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Cannot edit system templates' });
      }

      // Non-admin can only edit their own templates
      if (!template.isSystem && template.creatorId !== user.id && user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { name, description, noteType, specialty, sections, defaultValues, isActive } = req.body;

      const updateData: any = {};
      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (noteType) updateData.noteType = noteType;
      if (specialty !== undefined) updateData.specialty = specialty;
      if (sections) updateData.sections = sections;
      if (defaultValues !== undefined) updateData.defaultValues = defaultValues;
      if (isActive !== undefined) updateData.isActive = isActive;

      const updatedTemplate = await prisma.noteTemplate.update({
        where: { id: id as string },
        data: updateData,
      });

      await createAuditLog(user.id, 'UPDATE', 'NoteTemplate', id as string, template, updatedTemplate, req);

      res.status(200).json(updatedTemplate);
    } catch (error) {
      console.error('Update template error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const template = await prisma.noteTemplate.findUnique({
        where: { id: id as string },
      });

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Cannot delete system templates
      if (template.isSystem) {
        return res.status(403).json({ error: 'Cannot delete system templates' });
      }

      // Non-admin can only delete their own templates
      if (template.creatorId !== user.id && user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Soft delete
      await prisma.noteTemplate.update({
        where: { id: id as string },
        data: { isActive: false },
      });

      await createAuditLog(user.id, 'DELETE', 'NoteTemplate', id as string, template, null, req);

      res.status(200).json({ message: 'Template deleted' });
    } catch (error) {
      console.error('Delete template error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
