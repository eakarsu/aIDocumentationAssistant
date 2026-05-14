import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const { type, status, page = '1', limit = '20' } = req.query;

      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};
      if (type) where.type = type;
      if (status) where.status = status;

      const [integrations, total] = await Promise.all([
        prisma.integration.findMany({
          where,
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
            lastSyncAt: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            // Don't expose credentials
            configuration: true,
          },
          orderBy: { name: 'asc' },
          skip,
          take: limitNum,
        }),
        prisma.integration.count({ where }),
      ]);

      res.status(200).json({
        data: integrations,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error('Get integrations error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      const { name, type, configuration, credentials } = req.body;

      if (!name || !type) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const integration = await prisma.integration.create({
        data: {
          name,
          type,
          configuration: configuration || {},
          credentials: credentials || {},
          status: 'INACTIVE',
        },
      });

      await createAuditLog(user.id, 'CREATE', 'Integration', integration.id, null, { name, type }, req);

      res.status(201).json({
        id: integration.id,
        name: integration.name,
        type: integration.type,
        status: integration.status,
      });
    } catch (error) {
      console.error('Create integration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
