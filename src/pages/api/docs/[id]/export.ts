import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const doc = await prisma.doc.findUnique({
      where: { id: id as string },
      include: { collaborators: true },
    });

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check access
    const hasAccess =
      user.role === 'ADMIN' ||
      doc.authorId === user.id ||
      doc.visibility === 'PUBLIC' ||
      doc.visibility === 'INTERNAL' ||
      doc.collaborators.some(c => c.userId === user.id);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { format } = req.body;

    if (!format || !['PDF', 'HTML', 'DOCX', 'MARKDOWN'].includes(format)) {
      return res.status(400).json({ error: 'Valid format (PDF, HTML, DOCX, MARKDOWN) is required' });
    }

    // Create export job
    const exportJob = await prisma.docExport.create({
      data: {
        docId: id as string,
        format,
        status: 'PENDING',
        requestedById: user.id,
      },
    });

    // For MARKDOWN, complete immediately
    if (format === 'MARKDOWN') {
      await prisma.docExport.update({
        where: { id: exportJob.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      await createAuditLog(user.id, 'EXPORT', 'Doc', id as string, null, { format }, req);

      return res.status(200).json({
        exportId: exportJob.id,
        status: 'COMPLETED',
        format,
        content: doc.content,
        filename: `${doc.slug}.md`,
      });
    }

    // For other formats, return job ID (processed async)
    await createAuditLog(user.id, 'EXPORT', 'Doc', id as string, null, { format, exportId: exportJob.id }, req);

    res.status(202).json({
      exportId: exportJob.id,
      status: 'PENDING',
      format,
      message: 'Export job created. Check status at /api/docs/export/status/{exportId}',
    });
  } catch (error) {
    console.error('Export doc error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
