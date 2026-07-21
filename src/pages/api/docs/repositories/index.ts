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

  if (req.method === 'GET') {
    try {
      const where: any = { tenantId: tenant.tenantId };

      const repositories = await prisma.repository.findMany({
        where,
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              parsedFiles: true,
              webhookEvents: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      // Remove sensitive data
      const safeRepos = repositories.map(repo => ({
        ...repo,
        accessToken: repo.accessToken ? '***' : null,
        webhookSecret: repo.webhookSecret ? '***' : null,
      }));

      res.status(200).json(safeRepos);
    } catch (error) {
      console.error('Get repositories error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    try {
      const {
        name,
        fullName,
        provider = 'GITHUB',
        url,
        branch = 'main',
        accessToken,
        webhookSecret,
        syncPaths,
        connectorPolicy,
      } = req.body;

      if (!name || !fullName || !url) {
        return res.status(400).json({ error: 'Name, fullName, and URL are required' });
      }
      if (!['OWNER', 'ADMIN'].includes(tenant.role)) return res.status(403).json({ error: 'Tenant administrator role required' });
      if (provider !== 'GITHUB') return res.status(400).json({ error: 'Only the registered GITHUB connector is supported' });
      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName)) return res.status(400).json({ error: 'fullName must be owner/repository' });
      let parsedUrl: URL;
      try { parsedUrl = new URL(url); } catch { return res.status(400).json({ error: 'URL must be valid' }); }
      if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'github.com') return res.status(400).json({ error: 'GitHub URL must use https://github.com' });
      if (!/^[A-Za-z0-9._\/-]{1,255}$/.test(branch) || branch.includes('..')) return res.status(400).json({ error: 'Invalid branch' });
      const normalizedPaths = syncPaths === undefined ? [] : syncPaths;
      if (!Array.isArray(normalizedPaths) || normalizedPaths.length > 50 || normalizedPaths.some((path: unknown) => typeof path !== 'string' || !path || path.startsWith('/') || path.includes('..') || path.length > 500)) {
        return res.status(400).json({ error: 'syncPaths must contain at most 50 bounded repository-relative paths' });
      }
      if (accessToken !== undefined && (typeof accessToken !== 'string' || accessToken.length < 20 || accessToken.length > 2_000)) return res.status(400).json({ error: 'Invalid access token' });
      if (webhookSecret !== undefined && (typeof webhookSecret !== 'string' || webhookSecret.length < 32 || webhookSecret.length > 500)) return res.status(400).json({ error: 'Webhook secret must contain 32-500 characters' });
      const readPrincipals = connectorPolicy?.readPrincipals;
      if (readPrincipals !== undefined && (!Array.isArray(readPrincipals) || readPrincipals.length > 100 || readPrincipals.some((principal: unknown) => typeof principal !== 'string' || !/^(tenant|user|role):[A-Za-z0-9_.:-]+$/.test(principal)))) {
        return res.status(400).json({ error: 'connectorPolicy.readPrincipals is invalid' });
      }

      // Check if repository already exists
      const existing = await prisma.repository.findUnique({
        where: {
          provider_tenantId_fullName: {
            tenantId: tenant.tenantId,
            provider,
            fullName,
          },
        },
      });

      if (existing) {
        return res.status(400).json({ error: 'Repository already connected' });
      }

      const repository = await prisma.repository.create({
        data: {
          name,
          fullName,
          provider,
          url,
          branch,
          accessToken: accessToken ? encrypt(accessToken) : null,
          webhookSecret: webhookSecret ? encrypt(webhookSecret) : null,
          syncPaths: normalizedPaths,
          connectorPolicy: { readPrincipals: readPrincipals || [`tenant:${tenant.tenantId}`] },
          tenantId: tenant.tenantId,
          createdById: user.id,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      await createAuditLog(user.id, 'CREATE', 'Repository', repository.id, null, { name, fullName, provider }, req);

      res.status(201).json({
        ...repository,
        accessToken: repository.accessToken ? '***' : null,
      });
    } catch (error) {
      console.error('Create repository error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
