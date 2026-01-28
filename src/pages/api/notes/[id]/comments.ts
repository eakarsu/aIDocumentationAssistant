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
      const comments = await prisma.comment.findMany({
        where: {
          noteId: id as string,
          parentId: null,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
          replies: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json(comments);
    } catch (error) {
      console.error('Get comments error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    try {
      const { content, parentId } = req.body;

      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }

      const note = await prisma.note.findUnique({
        where: { id: id as string },
      });

      if (!note) {
        return res.status(404).json({ error: 'Note not found' });
      }

      const comment = await prisma.comment.create({
        data: {
          noteId: id as string,
          userId: user.id,
          content,
          parentId: parentId || null,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      });

      await createAuditLog(user.id, 'CREATE', 'Comment', comment.id, null, comment, req);

      res.status(201).json(comment);
    } catch (error) {
      console.error('Create comment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { commentId, isResolved } = req.body;

      if (!commentId) {
        return res.status(400).json({ error: 'Comment ID is required' });
      }

      const comment = await prisma.comment.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      const updatedComment = await prisma.comment.update({
        where: { id: commentId },
        data: { isResolved },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      await createAuditLog(user.id, 'UPDATE', 'Comment', commentId, comment, updatedComment, req);

      res.status(200).json(updatedComment);
    } catch (error) {
      console.error('Update comment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { commentId } = req.body;

      if (!commentId) {
        return res.status(400).json({ error: 'Comment ID is required' });
      }

      const comment = await prisma.comment.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      if (comment.userId !== user.id && user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await prisma.comment.delete({
        where: { id: commentId },
      });

      await createAuditLog(user.id, 'DELETE', 'Comment', commentId, comment, null, req);

      res.status(200).json({ message: 'Comment deleted' });
    } catch (error) {
      console.error('Delete comment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
