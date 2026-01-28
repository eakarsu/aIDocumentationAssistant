import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;

  if (req.method === 'POST') {
    // Request co-signature
    try {
      const { signerId } = req.body;

      if (!signerId) {
        return res.status(400).json({ error: 'Signer ID is required' });
      }

      const note = await prisma.note.findUnique({
        where: { id: id as string },
      });

      if (!note) {
        return res.status(404).json({ error: 'Note not found' });
      }

      if (note.authorId !== user.id) {
        return res.status(403).json({ error: 'Only the author can request co-signature' });
      }

      const signer = await prisma.user.findUnique({
        where: { id: signerId },
      });

      if (!signer || !signer.isActive) {
        return res.status(400).json({ error: 'Invalid signer' });
      }

      const existingRequest = await prisma.coSignature.findFirst({
        where: {
          noteId: id as string,
          signerId,
          status: 'PENDING',
        },
      });

      if (existingRequest) {
        return res.status(400).json({ error: 'Co-signature request already pending' });
      }

      const coSignature = await prisma.coSignature.create({
        data: {
          noteId: id as string,
          requesterId: user.id,
          signerId,
        },
        include: {
          signer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      await prisma.note.update({
        where: { id: id as string },
        data: { status: 'PENDING_COSIGN' },
      });

      await createAuditLog(user.id, 'COSIGN', 'Note', id as string, null, { requestedSigner: signerId }, req);

      res.status(201).json(coSignature);
    } catch (error) {
      console.error('Request cosign error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    // Respond to co-signature request
    try {
      const { action, comments } = req.body;

      if (!action || !['SIGNED', 'REJECTED'].includes(action)) {
        return res.status(400).json({ error: 'Valid action (SIGNED or REJECTED) is required' });
      }

      const coSignature = await prisma.coSignature.findFirst({
        where: {
          noteId: id as string,
          signerId: user.id,
          status: 'PENDING',
        },
      });

      if (!coSignature) {
        return res.status(404).json({ error: 'No pending co-signature request found' });
      }

      const updatedCoSignature = await prisma.coSignature.update({
        where: { id: coSignature.id },
        data: {
          status: action,
          comments,
          signedAt: action === 'SIGNED' ? new Date() : null,
        },
      });

      if (action === 'SIGNED') {
        await prisma.note.update({
          where: { id: id as string },
          data: { status: 'SIGNED' },
        });
      }

      await createAuditLog(user.id, 'COSIGN', 'Note', id as string, { status: 'PENDING' }, { status: action }, req);

      res.status(200).json(updatedCoSignature);
    } catch (error) {
      console.error('Cosign response error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
