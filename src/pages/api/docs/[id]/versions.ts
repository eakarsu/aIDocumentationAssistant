import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';
import removeMarkdown from 'remove-markdown';
import readingTime from 'reading-time';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;

  // Check doc exists and user has access
  const doc = await prisma.doc.findUnique({
    where: { id: id as string },
    include: { collaborators: true },
  });

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const hasAccess =
    user.role === 'ADMIN' ||
    doc.authorId === user.id ||
    doc.visibility === 'PUBLIC' ||
    doc.visibility === 'INTERNAL' ||
    doc.collaborators.some(c => c.userId === user.id);

  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (req.method === 'GET') {
    try {
      const { page = '1', limit = '20' } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

      const [versions, total] = await Promise.all([
        prisma.docVersion.findMany({
          where: { docId: id as string },
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { version: 'desc' },
          skip,
          take: parseInt(limit as string),
        }),
        prisma.docVersion.count({ where: { docId: id as string } }),
      ]);

      res.status(200).json({
        versions,
        pagination: {
          total,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          totalPages: Math.ceil(total / parseInt(limit as string)),
        },
      });
    } catch (error) {
      console.error('Get versions error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    // Restore a specific version
    try {
      const { versionNumber } = req.body;

      if (!versionNumber) {
        return res.status(400).json({ error: 'Version number is required' });
      }

      // Check edit permissions
      const canEdit =
        user.role === 'ADMIN' ||
        doc.authorId === user.id ||
        doc.collaborators.some(c => c.userId === user.id && ['EDIT', 'ADMIN'].includes(c.permission));

      if (!canEdit) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const targetVersion = await prisma.docVersion.findUnique({
        where: {
          docId_version: {
            docId: id as string,
            version: versionNumber,
          },
        },
      });

      if (!targetVersion) {
        return res.status(404).json({ error: 'Version not found' });
      }

      // Get latest version number
      const latestVersion = await prisma.docVersion.findFirst({
        where: { docId: id as string },
        orderBy: { version: 'desc' },
      });

      // Update doc with version content
      const plainText = removeMarkdown(targetVersion.content);
      const stats = readingTime(plainText);

      const updatedDoc = await prisma.doc.update({
        where: { id: id as string },
        data: {
          title: targetVersion.title,
          content: targetVersion.content,
          readingTime: Math.ceil(stats.minutes),
          wordCount: plainText.split(/\s+/).filter(Boolean).length,
        },
      });

      // Create new version recording the restore
      await prisma.docVersion.create({
        data: {
          docId: id as string,
          version: (latestVersion?.version || 0) + 1,
          title: targetVersion.title,
          content: targetVersion.content,
          changelog: `Restored from version ${versionNumber}`,
          createdById: user.id,
        },
      });

      // Update search index
      await prisma.docSearchIndex.upsert({
        where: { docId: id as string },
        create: {
          docId: id as string,
          searchVector: `${updatedDoc.title} ${plainText}`,
          titleVector: updatedDoc.title,
        },
        update: {
          searchVector: `${updatedDoc.title} ${plainText}`,
          titleVector: updatedDoc.title,
          lastIndexedAt: new Date(),
        },
      });

      await createAuditLog(user.id, 'UPDATE', 'Doc', id as string, doc, updatedDoc, req);

      res.status(200).json({ message: `Restored to version ${versionNumber}`, doc: updatedDoc });
    } catch (error) {
      console.error('Restore version error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
