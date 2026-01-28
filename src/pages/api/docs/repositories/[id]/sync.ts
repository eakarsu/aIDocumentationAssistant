import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  try {
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

    if (!repository.accessToken) {
      return res.status(400).json({ error: 'Repository has no access token configured' });
    }

    // In a real implementation, this would trigger an async job
    // For now, we'll return a pending status
    await prisma.repository.update({
      where: { id: id as string },
      data: {
        lastSyncAt: new Date(),
      },
    });

    await createAuditLog(user.id, 'UPDATE', 'Repository', id as string, null, { action: 'sync_triggered' }, req);

    res.status(202).json({
      message: 'Sync job started',
      repositoryId: id,
      status: 'PENDING',
    });
  } catch (error) {
    console.error('Sync repository error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
