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
      const note = await prisma.note.findUnique({
        where: { id: id as string },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              specialty: true,
              email: true,
            },
          },
          template: {
            select: {
              id: true,
              name: true,
              sections: true,
            },
          },
          versions: {
            orderBy: { version: 'desc' },
            take: 10,
          },
          recordings: {
            select: {
              id: true,
              type: true,
              status: true,
              fileName: true,
              duration: true,
              recordedAt: true,
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
          amendments: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          coSignatures: {
            include: {
              signer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          medicalCodes: true,
        },
      });

      if (!note) {
        return res.status(404).json({ error: 'Note not found' });
      }

      // Check access permissions
      if (user.role !== 'ADMIN' && note.authorId !== user.id) {
        // Check if user has access through co-signature
        const hasAccess = note.coSignatures.some(cs => cs.signerId === user.id);
        if (!hasAccess) {
          await createAuditLog(user.id, 'ACCESS_DENIED', 'Note', id as string, null, null, req);
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      await createAuditLog(user.id, 'READ', 'Note', id as string, null, null, req);

      res.status(200).json(note);
    } catch (error) {
      console.error('Get note error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    try {
      const note = await prisma.note.findUnique({
        where: { id: id as string },
      });

      if (!note) {
        return res.status(404).json({ error: 'Note not found' });
      }

      // Only author or admin can edit
      if (user.role !== 'ADMIN' && note.authorId !== user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Cannot edit locked notes
      if (note.status === 'LOCKED') {
        return res.status(400).json({ error: 'Cannot edit locked note' });
      }

      const { content, sections, status, patientName, encounterDate, noteType } = req.body;

      const updateData: any = {};

      if (content) updateData.content = content;
      if (sections) updateData.sections = sections;
      if (patientName) updateData.patientName = patientName;
      if (encounterDate) updateData.encounterDate = new Date(encounterDate);
      if (noteType) updateData.noteType = noteType;
      if (status && ['DRAFT', 'PENDING_REVIEW', 'PENDING_COSIGN'].includes(status)) {
        updateData.status = status;
      }

      const updatedNote = await prisma.note.update({
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
          template: {
            select: {
              id: true,
              name: true,
              sections: true,
            },
          },
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
          content: updatedNote.content as object,
          sections: updatedNote.sections as object || undefined,
          changedBy: user.id,
          changeLog: 'Content updated',
        },
      });

      await createAuditLog(user.id, 'UPDATE', 'Note', id as string, note, updatedNote, req);

      res.status(200).json(updatedNote);
    } catch (error) {
      console.error('Update note error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const note = await prisma.note.findUnique({
        where: { id: id as string },
      });

      if (!note) {
        return res.status(404).json({ error: 'Note not found' });
      }

      // Only author or admin can delete
      if (user.role !== 'ADMIN' && note.authorId !== user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Cannot delete signed/locked notes
      if (['SIGNED', 'LOCKED'].includes(note.status)) {
        return res.status(400).json({ error: 'Cannot delete signed or locked note' });
      }

      await prisma.note.delete({
        where: { id: id as string },
      });

      await createAuditLog(user.id, 'DELETE', 'Note', id as string, note, null, req);

      res.status(200).json({ message: 'Note deleted successfully' });
    } catch (error) {
      console.error('Delete note error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
