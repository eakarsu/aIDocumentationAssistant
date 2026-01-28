import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';
import slugify from 'slugify';
import readingTime from 'reading-time';
import removeMarkdown from 'remove-markdown';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const {
        status,
        visibility,
        categoryId,
        authorId,
        search,
        tag,
        page = '1',
        limit = '20',
        sortBy = 'updatedAt',
        sortOrder = 'desc'
      } = req.query;

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

      const where: any = {
        OR: [
          { authorId: user.id },
          { visibility: 'PUBLIC' },
          { visibility: 'INTERNAL' },
          { collaborators: { some: { userId: user.id } } }
        ]
      };

      if (user.role === 'ADMIN') {
        delete where.OR;
      }

      if (status) {
        where.status = status;
      }

      if (visibility) {
        where.visibility = visibility;
      }

      if (categoryId) {
        where.categoryId = categoryId;
      }

      if (authorId) {
        where.authorId = authorId;
      }

      if (tag) {
        where.tags = {
          some: {
            tag: {
              slug: tag
            }
          }
        };
      }

      if (search) {
        where.AND = [
          {
            OR: [
              { title: { contains: search as string, mode: 'insensitive' } },
              { content: { contains: search as string, mode: 'insensitive' } },
              { excerpt: { contains: search as string, mode: 'insensitive' } }
            ]
          }
        ];
      }

      const orderBy: any = {};
      orderBy[sortBy as string] = sortOrder;

      const [docs, total] = await Promise.all([
        prisma.doc.findMany({
          where,
          include: {
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
            template: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
            tags: {
              include: {
                tag: true,
              },
            },
            _count: {
              select: {
                comments: true,
                versions: true,
                collaborators: true,
              },
            },
          },
          skip,
          take: parseInt(limit as string),
          orderBy,
        }),
        prisma.doc.count({ where }),
      ]);

      await createAuditLog(user.id, 'READ', 'Doc', 'list', null, null, req);

      res.status(200).json({
        docs,
        pagination: {
          total,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          totalPages: Math.ceil(total / parseInt(limit as string)),
        },
      });
    } catch (error) {
      console.error('Get docs error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    try {
      const {
        title,
        content = '',
        excerpt,
        templateId,
        categoryId,
        status = 'DRAFT',
        visibility = 'PRIVATE',
        tags = [],
        metadata
      } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      // Generate unique slug
      let baseSlug = slugify(title, { lower: true, strict: true });
      let slug = baseSlug;
      let counter = 1;

      while (await prisma.doc.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      // Calculate reading time and word count
      const plainText = removeMarkdown(content);
      const stats = readingTime(plainText);
      const wordCount = plainText.split(/\s+/).filter(Boolean).length;

      // Get template content if templateId provided
      let finalContent = content;
      if (templateId && !content) {
        const template = await prisma.docTemplate.findUnique({
          where: { id: templateId }
        });
        if (template) {
          finalContent = template.content;
        }
      }

      const doc = await prisma.doc.create({
        data: {
          title,
          slug,
          content: finalContent,
          excerpt: excerpt || plainText.slice(0, 200),
          status,
          visibility,
          templateId,
          categoryId,
          authorId: user.id,
          readingTime: Math.ceil(stats.minutes),
          wordCount,
          metadata,
          publishedAt: status === 'PUBLISHED' ? new Date() : null,
        },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          category: true,
          template: true,
        },
      });

      // Create initial version
      await prisma.docVersion.create({
        data: {
          docId: doc.id,
          version: 1,
          title: doc.title,
          content: doc.content,
          changelog: 'Initial creation',
          createdById: user.id,
        },
      });

      // Create search index
      await prisma.docSearchIndex.create({
        data: {
          docId: doc.id,
          searchVector: `${doc.title} ${plainText}`,
          titleVector: doc.title,
        },
      });

      // Add tags
      if (tags.length > 0) {
        for (const tagName of tags) {
          let tagSlug = slugify(tagName, { lower: true, strict: true });
          let tag = await prisma.docTag.findUnique({ where: { slug: tagSlug } });

          if (!tag) {
            tag = await prisma.docTag.create({
              data: {
                name: tagName,
                slug: tagSlug,
              },
            });
          }

          await prisma.docTagAssignment.create({
            data: {
              docId: doc.id,
              tagId: tag.id,
            },
          });
        }
      }

      await createAuditLog(user.id, 'CREATE', 'Doc', doc.id, null, doc, req);

      res.status(201).json(doc);
    } catch (error) {
      console.error('Create doc error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
