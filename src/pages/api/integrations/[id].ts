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
      const integration = await prisma.integration.findUnique({
        where: { id: id as string },
        include: {
          syncLogs: {
            orderBy: { startedAt: 'desc' },
            take: 10,
          },
        },
      });

      if (!integration) {
        return res.status(404).json({ error: 'Integration not found' });
      }

      // Hide credentials for non-admins
      const response = {
        ...integration,
        credentials: user.role === 'ADMIN' ? integration.credentials : undefined,
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Get integration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      const { name, configuration, credentials, status, isActive } = req.body;

      const updateData: any = {};
      if (name) updateData.name = name;
      if (configuration) updateData.configuration = configuration;
      if (credentials) updateData.credentials = credentials;
      if (status) updateData.status = status;
      if (isActive !== undefined) updateData.isActive = isActive;

      const integration = await prisma.integration.update({
        where: { id: id as string },
        data: updateData,
      });

      await createAuditLog(user.id, 'UPDATE', 'Integration', id as string, null, { updated: Object.keys(updateData) }, req);

      res.status(200).json({
        id: integration.id,
        name: integration.name,
        type: integration.type,
        status: integration.status,
        isActive: integration.isActive,
      });
    } catch (error) {
      console.error('Update integration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      await prisma.integration.update({
        where: { id: id as string },
        data: { isActive: false, status: 'INACTIVE' },
      });

      await createAuditLog(user.id, 'DELETE', 'Integration', id as string, null, null, req);

      res.status(200).json({ message: 'Integration deactivated' });
    } catch (error) {
      console.error('Delete integration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
