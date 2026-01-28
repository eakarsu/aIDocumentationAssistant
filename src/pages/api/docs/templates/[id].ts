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
      const template = await prisma.docTemplate.findUnique({
        where: { id: id as string },
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
      const template = await prisma.docTemplate.findUnique({
        where: { id: id as string },
      });

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Only creator or admin can edit non-system templates
      if (template.isSystem && user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Cannot modify system templates' });
      }

      if (!template.isSystem && template.creatorId !== user.id && user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { name, description, type, content, structure, isActive } = req.body;

      const updateData: any = {};
      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (type) updateData.type = type;
      if (content) updateData.content = content;
      if (structure !== undefined) updateData.structure = structure;
      if (isActive !== undefined) updateData.isActive = isActive;

      const updatedTemplate = await prisma.docTemplate.update({
        where: { id: id as string },
        data: updateData,
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

      await createAuditLog(user.id, 'UPDATE', 'DocTemplate', id as string, template, updatedTemplate, req);

      res.status(200).json(updatedTemplate);
    } catch (error) {
      console.error('Update template error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const template = await prisma.docTemplate.findUnique({
        where: { id: id as string },
      });

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      if (template.isSystem) {
        return res.status(403).json({ error: 'Cannot delete system templates' });
      }

      if (template.creatorId !== user.id && user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await prisma.docTemplate.delete({
        where: { id: id as string },
      });

      await createAuditLog(user.id, 'DELETE', 'DocTemplate', id as string, template, null, req);

      res.status(200).json({ message: 'Template deleted successfully' });
    } catch (error) {
      console.error('Delete template error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
