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

  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const doc = await prisma.doc.findUnique({
        where: { id: id as string },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          category: true,
          template: true,
          tags: {
            include: {
              tag: true,
            },
          },
          versions: {
            orderBy: { version: 'desc' },
            take: 10,
            include: {
              createdBy: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          comments: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
              replies: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
            where: { parentId: null },
            orderBy: { createdAt: 'desc' },
          },
          collaborators: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          _count: {
            select: {
              comments: true,
              versions: true,
              collaborators: true,
              exports: true,
            },
          },
        },
      });

      if (!doc) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Check access permissions
      const hasAccess =
        user.role === 'ADMIN' ||
        doc.authorId === user.id ||
        doc.visibility === 'PUBLIC' ||
        (doc.visibility === 'INTERNAL') ||
        doc.collaborators.some(c => c.userId === user.id);

      if (!hasAccess) {
        await createAuditLog(user.id, 'ACCESS_DENIED', 'Doc', id as string, null, null, req);
        return res.status(403).json({ error: 'Access denied' });
      }

      await createAuditLog(user.id, 'READ', 'Doc', id as string, null, null, req);

      res.status(200).json(doc);
    } catch (error) {
      console.error('Get doc error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    try {
      const doc = await prisma.doc.findUnique({
        where: { id: id as string },
        include: { collaborators: true },
      });

      if (!doc) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Check edit permissions
      const canEdit =
        user.role === 'ADMIN' ||
        doc.authorId === user.id ||
        doc.collaborators.some(c => c.userId === user.id && ['EDIT', 'ADMIN'].includes(c.permission));

      if (!canEdit) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const {
        title,
        content,
        excerpt,
        status,
        visibility,
        categoryId,
        tags,
        metadata,
        changelog
      } = req.body;

      const updateData: any = {};

      if (title) {
        updateData.title = title;
        // Update slug only if title changed significantly
        if (title !== doc.title) {
          let baseSlug = slugify(title, { lower: true, strict: true });
          let slug = baseSlug;
          let counter = 1;

          while (true) {
            const existing = await prisma.doc.findUnique({ where: { slug } });
            if (!existing || existing.id === doc.id) break;
            slug = `${baseSlug}-${counter}`;
            counter++;
          }
          updateData.slug = slug;
        }
      }

      if (content !== undefined) {
        updateData.content = content;
        const plainText = removeMarkdown(content);
        const stats = readingTime(plainText);
        updateData.readingTime = Math.ceil(stats.minutes);
        updateData.wordCount = plainText.split(/\s+/).filter(Boolean).length;

        if (!excerpt) {
          updateData.excerpt = plainText.slice(0, 200);
        }
      }

      if (excerpt) updateData.excerpt = excerpt;
      if (visibility) updateData.visibility = visibility;
      if (categoryId !== undefined) updateData.categoryId = categoryId || null;
      if (metadata) updateData.metadata = metadata;

      if (status) {
        updateData.status = status;
        if (status === 'PUBLISHED' && !doc.publishedAt) {
          updateData.publishedAt = new Date();
        }
      }

      const updatedDoc = await prisma.doc.update({
        where: { id: id as string },
        data: updateData,
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
          tags: {
            include: {
              tag: true,
            },
          },
        },
      });

      // Create new version if content changed
      if (content !== undefined && content !== doc.content) {
        const latestVersion = await prisma.docVersion.findFirst({
          where: { docId: id as string },
          orderBy: { version: 'desc' },
        });

        await prisma.docVersion.create({
          data: {
            docId: id as string,
            version: (latestVersion?.version || 0) + 1,
            title: updatedDoc.title,
            content: updatedDoc.content,
            changelog: changelog || 'Content updated',
            createdById: user.id,
          },
        });

        // Update search index
        await prisma.docSearchIndex.upsert({
          where: { docId: id as string },
          create: {
            docId: id as string,
            searchVector: `${updatedDoc.title} ${removeMarkdown(updatedDoc.content)}`,
            titleVector: updatedDoc.title,
          },
          update: {
            searchVector: `${updatedDoc.title} ${removeMarkdown(updatedDoc.content)}`,
            titleVector: updatedDoc.title,
            lastIndexedAt: new Date(),
          },
        });
      }

      // Update tags if provided
      if (tags !== undefined) {
        // Remove existing tags
        await prisma.docTagAssignment.deleteMany({
          where: { docId: id as string },
        });

        // Add new tags
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
              docId: id as string,
              tagId: tag.id,
            },
          });
        }
      }

      await createAuditLog(user.id, 'UPDATE', 'Doc', id as string, doc, updatedDoc, req);

      res.status(200).json(updatedDoc);
    } catch (error) {
      console.error('Update doc error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const doc = await prisma.doc.findUnique({
        where: { id: id as string },
        include: { collaborators: true },
      });

      if (!doc) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Only author or admin can delete
      const canDelete =
        user.role === 'ADMIN' ||
        doc.authorId === user.id ||
        doc.collaborators.some(c => c.userId === user.id && c.permission === 'ADMIN');

      if (!canDelete) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await prisma.doc.delete({
        where: { id: id as string },
      });

      await createAuditLog(user.id, 'DELETE', 'Doc', id as string, doc, null, req);

      res.status(200).json({ message: 'Document deleted successfully' });
    } catch (error) {
      console.error('Delete doc error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
