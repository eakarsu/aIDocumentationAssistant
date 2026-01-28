import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';
import { marked } from 'marked';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { docId, options = {} } = req.body;

    if (!docId) {
      return res.status(400).json({ error: 'Document ID is required' });
    }

    const doc = await prisma.doc.findUnique({
      where: { id: docId },
      include: {
        author: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        category: true,
        collaborators: true,
      },
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

    // Convert markdown to HTML
    const htmlContent = await marked(doc.content);

    // Create styled HTML document
    const styledHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${doc.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #333;
    }
    h1 { color: #1a1a1a; border-bottom: 2px solid #eee; padding-bottom: 10px; }
    h2 { color: #2c3e50; margin-top: 30px; }
    h3 { color: #34495e; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: 'Fira Code', monospace; }
    pre { background: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 5px; overflow-x: auto; }
    pre code { background: none; color: inherit; }
    blockquote { border-left: 4px solid #3498db; margin-left: 0; padding-left: 20px; color: #666; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background: #f5f5f5; }
    img { max-width: 100%; }
    .meta { color: #666; font-size: 0.9em; margin-bottom: 30px; }
  </style>
</head>
<body>
  <h1>${doc.title}</h1>
  <div class="meta">
    <p>Author: ${doc.author.firstName} ${doc.author.lastName}</p>
    ${doc.category ? `<p>Category: ${doc.category.name}</p>` : ''}
    <p>Last updated: ${new Date(doc.updatedAt).toLocaleDateString()}</p>
  </div>
  ${htmlContent}
</body>
</html>
    `;

    // Create export record
    const exportJob = await prisma.docExport.create({
      data: {
        docId,
        format: 'PDF',
        status: 'PROCESSING',
        requestedById: user.id,
      },
    });

    // Note: In production, you would use puppeteer to generate the actual PDF
    // For now, we return the HTML that can be rendered as PDF client-side
    await prisma.docExport.update({
      where: { id: exportJob.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    await createAuditLog(user.id, 'EXPORT', 'Doc', docId, null, { format: 'PDF', exportId: exportJob.id }, req);

    res.status(200).json({
      exportId: exportJob.id,
      format: 'PDF',
      html: styledHtml,
      filename: `${doc.slug}.pdf`,
    });
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
