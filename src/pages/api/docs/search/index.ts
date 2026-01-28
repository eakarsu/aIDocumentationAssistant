import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      q,
      category,
      tag,
      status,
      author,
      page = '1',
      limit = '20',
    } = req.query;

    if (!q || (q as string).trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const searchTerms = (q as string).trim().toLowerCase();
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Build where clause
    const where: any = {
      AND: [
        // Access control
        {
          OR: [
            { authorId: user.id },
            { visibility: 'PUBLIC' },
            { visibility: 'INTERNAL' },
            { collaborators: { some: { userId: user.id } } },
          ],
        },
        // Search condition
        {
          OR: [
            { title: { contains: searchTerms, mode: 'insensitive' } },
            { content: { contains: searchTerms, mode: 'insensitive' } },
            { excerpt: { contains: searchTerms, mode: 'insensitive' } },
            { searchIndex: { searchVector: { contains: searchTerms, mode: 'insensitive' } } },
          ],
        },
      ],
    };

    if (user.role === 'ADMIN') {
      where.AND[0] = {};
    }

    // Additional filters
    if (category) {
      where.categoryId = category;
    }

    if (tag) {
      where.tags = {
        some: {
          tag: { slug: tag },
        },
      };
    }

    if (status) {
      where.status = status;
    }

    if (author) {
      where.authorId = author;
    }

    const [docs, total] = await Promise.all([
      prisma.doc.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          status: true,
          visibility: true,
          readingTime: true,
          updatedAt: true,
          publishedAt: true,
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              color: true,
            },
          },
          tags: {
            include: {
              tag: true,
            },
          },
        },
        skip,
        take: parseInt(limit as string),
        orderBy: [
          { publishedAt: 'desc' },
          { updatedAt: 'desc' },
        ],
      }),
      prisma.doc.count({ where }),
    ]);

    // Highlight search terms in results
    const highlightedDocs = docs.map(doc => {
      const regex = new RegExp(`(${searchTerms.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      return {
        ...doc,
        highlightedTitle: doc.title.replace(regex, '<mark>$1</mark>'),
        highlightedExcerpt: doc.excerpt?.replace(regex, '<mark>$1</mark>'),
      };
    });

    await createAuditLog(user.id, 'READ', 'Doc', 'search', null, { query: q, results: total }, req);

    res.status(200).json({
      query: q,
      docs: highlightedDocs,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error('Search docs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
