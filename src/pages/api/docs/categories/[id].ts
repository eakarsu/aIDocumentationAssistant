import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';
import slugify from 'slugify';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const category = await prisma.docCategory.findUnique({
        where: { id: id as string },
        include: {
          parent: true,
          children: {
            include: {
              _count: {
                select: { docs: true },
              },
            },
          },
          docs: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              updatedAt: true,
            },
            take: 10,
            orderBy: { updatedAt: 'desc' },
          },
          _count: {
            select: { docs: true },
          },
        },
      });

      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }

      res.status(200).json(category);
    } catch (error) {
      console.error('Get category error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    try {
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const category = await prisma.docCategory.findUnique({
        where: { id: id as string },
      });

      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }

      const { name, description, icon, color, parentId, orderIndex } = req.body;

      const updateData: any = {};

      if (name) {
        updateData.name = name;
        if (name !== category.name) {
          let baseSlug = slugify(name, { lower: true, strict: true });
          let slug = baseSlug;
          let counter = 1;

          while (true) {
            const existing = await prisma.docCategory.findUnique({ where: { slug } });
            if (!existing || existing.id === category.id) break;
            slug = `${baseSlug}-${counter}`;
            counter++;
          }
          updateData.slug = slug;
        }
      }

      if (description !== undefined) updateData.description = description;
      if (icon !== undefined) updateData.icon = icon;
      if (color !== undefined) updateData.color = color;
      if (parentId !== undefined) {
        // Prevent setting self as parent
        if (parentId === id) {
          return res.status(400).json({ error: 'Category cannot be its own parent' });
        }
        updateData.parentId = parentId || null;
      }
      if (orderIndex !== undefined) updateData.orderIndex = orderIndex;

      const updatedCategory = await prisma.docCategory.update({
        where: { id: id as string },
        data: updateData,
        include: {
          parent: true,
          _count: {
            select: { docs: true },
          },
        },
      });

      await createAuditLog(user.id, 'UPDATE', 'DocCategory', id as string, category, updatedCategory, req);

      res.status(200).json(updatedCategory);
    } catch (error) {
      console.error('Update category error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    try {
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const category = await prisma.docCategory.findUnique({
        where: { id: id as string },
        include: {
          _count: {
            select: { docs: true, children: true },
          },
        },
      });

      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }

      if (category._count.docs > 0) {
        return res.status(400).json({ error: 'Cannot delete category with documents. Move documents first.' });
      }

      if (category._count.children > 0) {
        return res.status(400).json({ error: 'Cannot delete category with child categories. Delete children first.' });
      }

      await prisma.docCategory.delete({
        where: { id: id as string },
      });

      await createAuditLog(user.id, 'DELETE', 'DocCategory', id as string, category, null, req);

      res.status(200).json({ message: 'Category deleted successfully' });
    } catch (error) {
      console.error('Delete category error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
