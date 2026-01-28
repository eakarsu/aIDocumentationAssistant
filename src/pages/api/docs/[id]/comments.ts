import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';

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
      const comments = await prisma.docComment.findMany({
        where: {
          docId: id as string,
          parentId: null,
        },
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
      // Check comment permission
      const canComment =
        user.role === 'ADMIN' ||
        doc.authorId === user.id ||
        doc.collaborators.some(c => c.userId === user.id && ['COMMENT', 'EDIT', 'ADMIN'].includes(c.permission));

      if (!canComment && doc.visibility === 'PRIVATE') {
        return res.status(403).json({ error: 'No permission to comment' });
      }

      const { content, parentId, lineStart, lineEnd } = req.body;

      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }

      const comment = await prisma.docComment.create({
        data: {
          docId: id as string,
          userId: user.id,
          content,
          parentId,
          lineStart,
          lineEnd,
        },
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

      await createAuditLog(user.id, 'CREATE', 'DocComment', comment.id, null, comment, req);

      res.status(201).json(comment);
    } catch (error) {
      console.error('Create comment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { commentId, content, isResolved } = req.body;

      if (!commentId) {
        return res.status(400).json({ error: 'Comment ID is required' });
      }

      const comment = await prisma.docComment.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      // Only comment author or doc author/admin can modify
      const canModify =
        user.role === 'ADMIN' ||
        comment.userId === user.id ||
        doc.authorId === user.id;

      if (!canModify) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const updateData: any = {};
      if (content) updateData.content = content;
      if (isResolved !== undefined) updateData.isResolved = isResolved;

      const updatedComment = await prisma.docComment.update({
        where: { id: commentId },
        data: updateData,
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

      await createAuditLog(user.id, 'UPDATE', 'DocComment', commentId, comment, updatedComment, req);

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

      const comment = await prisma.docComment.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      // Only comment author or doc author/admin can delete
      const canDelete =
        user.role === 'ADMIN' ||
        comment.userId === user.id ||
        doc.authorId === user.id;

      if (!canDelete) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await prisma.docComment.delete({
        where: { id: commentId },
      });

      await createAuditLog(user.id, 'DELETE', 'DocComment', commentId, comment, null, req);

      res.status(200).json({ message: 'Comment deleted successfully' });
    } catch (error) {
      console.error('Delete comment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
