import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, getTenantContext, createAuditLog } from '@/lib/auth';
import { encrypt } from '@/lib/encryption';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const tenant = await getTenantContext(req, user.id);
  if (!tenant) return res.status(403).json({ error: 'A valid x-tenant-id membership is required' });

  const { id } = req.query;

  const repository = await prisma.repository.findFirst({
    where: { id: id as string, tenantId: tenant.tenantId },
  });

  if (!repository) {
    return res.status(404).json({ error: 'Repository not found' });
  }

  if (req.method === 'GET') {
    try {
      const fullRepo = await prisma.repository.findFirst({
        where: { id: id as string, tenantId: tenant.tenantId },
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
      if (!['OWNER', 'ADMIN'].includes(tenant.role)) return res.status(403).json({ error: 'Tenant administrator role required' });
      const { branch, accessToken, webhookSecret, syncPaths, syncEnabled, connectorPolicy } = req.body;

      const updateData: any = {};

      if (branch) {
        if (typeof branch !== 'string' || !/^[A-Za-z0-9._\/-]{1,255}$/.test(branch) || branch.includes('..')) return res.status(400).json({ error: 'Invalid branch' });
        updateData.branch = branch;
      }
      if (accessToken) {
        if (typeof accessToken !== 'string' || accessToken.length < 20 || accessToken.length > 2_000) return res.status(400).json({ error: 'Invalid access token' });
        updateData.accessToken = encrypt(accessToken);
      }
      if (webhookSecret) {
        if (typeof webhookSecret !== 'string' || webhookSecret.length < 32 || webhookSecret.length > 500) return res.status(400).json({ error: 'Webhook secret must contain 32-500 characters' });
        updateData.webhookSecret = encrypt(webhookSecret);
      }
      if (syncPaths !== undefined) {
        if (!Array.isArray(syncPaths) || syncPaths.length > 50 || syncPaths.some((path: unknown) => typeof path !== 'string' || !path || path.startsWith('/') || path.includes('..') || path.length > 500)) return res.status(400).json({ error: 'Invalid syncPaths' });
        updateData.syncPaths = syncPaths;
      }
      if (connectorPolicy !== undefined) {
        const principals = connectorPolicy?.readPrincipals;
        if (!Array.isArray(principals) || principals.length > 100 || principals.some((principal: unknown) => typeof principal !== 'string' || !/^(tenant|user|role):[A-Za-z0-9_.:-]+$/.test(principal))) return res.status(400).json({ error: 'Invalid connector policy' });
        updateData.connectorPolicy = { readPrincipals: principals };
      }
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
      if (!['OWNER', 'ADMIN'].includes(tenant.role)) return res.status(403).json({ error: 'Tenant administrator role required' });
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
