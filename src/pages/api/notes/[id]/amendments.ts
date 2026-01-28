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
      const amendments = await prisma.amendment.findMany({
        where: { noteId: id as string },
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
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json(amendments);
    } catch (error) {
      console.error('Get amendments error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    try {
      const { reason, newContent } = req.body;

      if (!reason || !newContent) {
        return res.status(400).json({ error: 'Reason and new content are required' });
      }

      const note = await prisma.note.findUnique({
        where: { id: id as string },
      });

      if (!note) {
        return res.status(404).json({ error: 'Note not found' });
      }

      // Only allow amendments on signed notes
      if (note.status !== 'SIGNED' && note.status !== 'AMENDED') {
        return res.status(400).json({ error: 'Can only amend signed notes' });
      }

      const amendment = await prisma.amendment.create({
        data: {
          noteId: id as string,
          userId: user.id,
          reason,
          oldContent: note.content as object,
          newContent,
          status: user.role === 'ADMIN' || note.authorId === user.id ? 'APPROVED' : 'PENDING',
          approvedBy: user.role === 'ADMIN' || note.authorId === user.id ? user.id : null,
          approvedAt: user.role === 'ADMIN' || note.authorId === user.id ? new Date() : null,
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

      // If auto-approved, update the note
      if (amendment.status === 'APPROVED') {
        await prisma.note.update({
          where: { id: id as string },
          data: {
            content: newContent,
            status: 'AMENDED',
          },
        });

        // Create new version
        const latestVersion = await prisma.noteVersion.findFirst({
          where: { noteId: id as string },
          orderBy: { version: 'desc' },
        });

        await prisma.noteVersion.create({
          data: {
            noteId: id as string,
            version: (latestVersion?.version || 0) + 1,
            content: newContent,
            changedBy: user.id,
            changeLog: `Amendment: ${reason}`,
          },
        });
      }

      await createAuditLog(user.id, 'AMEND', 'Note', id as string, note.content as object, newContent, req);

      res.status(201).json(amendment);
    } catch (error) {
      console.error('Create amendment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    // Approve or reject amendment
    try {
      const { amendmentId, action } = req.body;

      if (!amendmentId || !['APPROVED', 'REJECTED'].includes(action)) {
        return res.status(400).json({ error: 'Amendment ID and valid action required' });
      }

      const amendment = await prisma.amendment.findUnique({
        where: { id: amendmentId },
        include: { note: true },
      });

      if (!amendment) {
        return res.status(404).json({ error: 'Amendment not found' });
      }

      // Only note author or admin can approve
      if (amendment.note.authorId !== user.id && user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const updatedAmendment = await prisma.amendment.update({
        where: { id: amendmentId },
        data: {
          status: action,
          approvedBy: user.id,
          approvedAt: new Date(),
        },
      });

      if (action === 'APPROVED') {
        await prisma.note.update({
          where: { id: id as string },
          data: {
            content: amendment.newContent as object,
            status: 'AMENDED',
          },
        });

        // Create new version
        const latestVersion = await prisma.noteVersion.findFirst({
          where: { noteId: id as string },
          orderBy: { version: 'desc' },
        });

        await prisma.noteVersion.create({
          data: {
            noteId: id as string,
            version: (latestVersion?.version || 0) + 1,
            content: amendment.newContent as object,
            changedBy: user.id,
            changeLog: `Amendment approved: ${amendment.reason}`,
          },
        });
      }

      res.status(200).json(updatedAmendment);
    } catch (error) {
      console.error('Update amendment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
