import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import removeMarkdown from 'remove-markdown';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { docId } = req.body;

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

    // Parse markdown content into paragraphs
    const lines = doc.content.split('\n');
    const children: Paragraph[] = [];

    // Add title
    children.push(
      new Paragraph({
        text: doc.title,
        heading: HeadingLevel.TITLE,
      })
    );

    // Add metadata
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Author: ${doc.author.firstName} ${doc.author.lastName}`,
            italics: true,
            size: 20,
          }),
        ],
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Last updated: ${new Date(doc.updatedAt).toLocaleDateString()}`,
            italics: true,
            size: 20,
          }),
        ],
      })
    );

    children.push(new Paragraph({ text: '' })); // Empty line

    // Process markdown lines
    for (const line of lines) {
      if (line.startsWith('# ')) {
        children.push(
          new Paragraph({
            text: line.slice(2),
            heading: HeadingLevel.HEADING_1,
          })
        );
      } else if (line.startsWith('## ')) {
        children.push(
          new Paragraph({
            text: line.slice(3),
            heading: HeadingLevel.HEADING_2,
          })
        );
      } else if (line.startsWith('### ')) {
        children.push(
          new Paragraph({
            text: line.slice(4),
            heading: HeadingLevel.HEADING_3,
          })
        );
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        children.push(
          new Paragraph({
            text: line.slice(2),
            bullet: { level: 0 },
          })
        );
      } else if (line.trim() === '') {
        children.push(new Paragraph({ text: '' }));
      } else {
        // Remove markdown formatting for plain text
        const plainText = removeMarkdown(line);
        children.push(
          new Paragraph({
            children: [new TextRun({ text: plainText })],
          })
        );
      }
    }

    // Create document
    const document = new Document({
      sections: [
        {
          properties: {},
          children,
        },
      ],
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(document);
    const base64 = buffer.toString('base64');

    // Create export record
    const exportJob = await prisma.docExport.create({
      data: {
        docId,
        format: 'DOCX',
        status: 'COMPLETED',
        requestedById: user.id,
        completedAt: new Date(),
        fileSize: buffer.length,
      },
    });

    await createAuditLog(user.id, 'EXPORT', 'Doc', docId, null, { format: 'DOCX', exportId: exportJob.id }, req);

    res.status(200).json({
      exportId: exportJob.id,
      format: 'DOCX',
      content: base64,
      filename: `${doc.slug}.docx`,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  } catch (error) {
    console.error('DOCX export error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
