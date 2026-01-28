import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';
import { encrypt } from '@/lib/encryption';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const where: any = {};

      if (user.role !== 'ADMIN') {
        where.createdById = user.id;
      }

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
        syncPaths,
      } = req.body;

      if (!name || !fullName || !url) {
        return res.status(400).json({ error: 'Name, fullName, and URL are required' });
      }

      // Check if repository already exists
      const existing = await prisma.repository.findUnique({
        where: {
          provider_fullName: {
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
          syncPaths,
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
