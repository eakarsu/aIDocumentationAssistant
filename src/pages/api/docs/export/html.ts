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
        tags: { include: { tag: true } },
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

    // Build standalone HTML
    const standalone = options.standalone !== false;

    let output: string;
    if (standalone) {
      output = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="author" content="${doc.author.firstName} ${doc.author.lastName}">
  <meta name="description" content="${doc.excerpt || ''}">
  <title>${doc.title}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #24292e;
      background: #fff;
      margin: 0;
      padding: 0;
    }
    .container { max-width: 900px; margin: 0 auto; padding: 40px 20px; }
    header { margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid #eaecef; }
    h1 { margin: 0 0 10px 0; font-size: 2.5em; }
    .meta { color: #586069; font-size: 0.9em; }
    .tags { margin-top: 15px; }
    .tag { display: inline-block; padding: 3px 10px; background: #f1f8ff; color: #0366d6; border-radius: 15px; font-size: 0.8em; margin-right: 5px; }
    article { }
    h2 { margin-top: 40px; padding-bottom: 10px; border-bottom: 1px solid #eaecef; }
    h3 { margin-top: 30px; }
    code { background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; }
    pre { background: #24292e; color: #e1e4e8; padding: 16px; overflow-x: auto; border-radius: 6px; }
    pre code { background: none; padding: 0; color: inherit; }
    blockquote { border-left: 4px solid #dfe2e5; margin: 0; padding: 0 16px; color: #6a737d; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid #dfe2e5; padding: 8px 12px; }
    th { background: #f6f8fa; font-weight: 600; }
    img { max-width: 100%; height: auto; }
    a { color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #eaecef; color: #586069; font-size: 0.85em; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${doc.title}</h1>
      <div class="meta">
        <span>By ${doc.author.firstName} ${doc.author.lastName}</span>
        ${doc.category ? ` | <span>${doc.category.name}</span>` : ''}
        | <span>${new Date(doc.updatedAt).toLocaleDateString()}</span>
        ${doc.readingTime ? ` | <span>${doc.readingTime} min read</span>` : ''}
      </div>
      ${doc.tags.length > 0 ? `
      <div class="tags">
        ${doc.tags.map(t => `<span class="tag">${t.tag.name}</span>`).join('')}
      </div>
      ` : ''}
    </header>
    <article>
      ${htmlContent}
    </article>
    <footer>
      <p>Generated from documentation system</p>
    </footer>
  </div>
</body>
</html>`;
    } else {
      output = htmlContent;
    }

    // Create export record
    const exportJob = await prisma.docExport.create({
      data: {
        docId,
        format: 'HTML',
        status: 'COMPLETED',
        requestedById: user.id,
        completedAt: new Date(),
      },
    });

    await createAuditLog(user.id, 'EXPORT', 'Doc', docId, null, { format: 'HTML', exportId: exportJob.id }, req);

    res.status(200).json({
      exportId: exportJob.id,
      format: 'HTML',
      content: output,
      filename: `${doc.slug}.html`,
    });
  } catch (error) {
    console.error('HTML export error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
