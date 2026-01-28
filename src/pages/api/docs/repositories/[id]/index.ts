import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';
import { encrypt } from '@/lib/encryption';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;

  const repository = await prisma.repository.findUnique({
    where: { id: id as string },
  });

  if (!repository) {
    return res.status(404).json({ error: 'Repository not found' });
  }

  // Check access
  if (user.role !== 'ADMIN' && repository.createdById !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (req.method === 'GET') {
    try {
      const fullRepo = await prisma.repository.findUnique({
        where: { id: id as string },
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          parsedFiles: {
            select: {
              id: true,
              filePath: true,
              language: true,
              lineCount: true,
              parsedAt: true,
            },
            orderBy: { filePath: 'asc' },
          },
          webhookEvents: {
            select: {
              id: true,
              eventType: true,
              status: true,
              receivedAt: true,
            },
            orderBy: { receivedAt: 'desc' },
            take: 10,
          },
          _count: {
            select: {
              parsedFiles: true,
              webhookEvents: true,
            },
          },
        },
      });

      res.status(200).json({
        ...fullRepo,
        accessToken: fullRepo?.accessToken ? '***' : null,
        webhookSecret: fullRepo?.webhookSecret ? '***' : null,
      });
    } catch (error) {
      console.error('Get repository error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { branch, accessToken, syncPaths, syncEnabled } = req.body;

      const updateData: any = {};

      if (branch) updateData.branch = branch;
      if (accessToken) updateData.accessToken = encrypt(accessToken);
      if (syncPaths !== undefined) updateData.syncPaths = syncPaths;
      if (syncEnabled !== undefined) updateData.syncEnabled = syncEnabled;

      const updatedRepo = await prisma.repository.update({
        where: { id: id as string },
        data: updateData,
      });

      await createAuditLog(user.id, 'UPDATE', 'Repository', id as string, repository, updatedRepo, req);

      res.status(200).json({
        ...updatedRepo,
        accessToken: updatedRepo.accessToken ? '***' : null,
        webhookSecret: updatedRepo.webhookSecret ? '***' : null,
      });
    } catch (error) {
      console.error('Update repository error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    try {
      await prisma.repository.delete({
        where: { id: id as string },
      });

      await createAuditLog(user.id, 'DELETE', 'Repository', id as string, repository, null, req);

      res.status(200).json({ message: 'Repository deleted successfully' });
    } catch (error) {
      console.error('Delete repository error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
