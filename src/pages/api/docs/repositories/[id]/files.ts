import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, getTenantContext } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const tenant = await getTenantContext(req, user.id);
  if (!tenant) return res.status(403).json({ error: 'A valid x-tenant-id membership is required' });

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  try {
    const repository = await prisma.repository.findFirst({
      where: { id: id as string, tenantId: tenant.tenantId },
    });

    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const { language, search, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {
      repositoryId: id as string,
      deletedAt: null,
    };

    if (language) {
      where.language = language;
    }

    if (search) {
      where.filePath = {
        contains: search as string,
        mode: 'insensitive',
      };
    }

    const [files, total] = await Promise.all([
      prisma.parsedCodeFile.findMany({
        where,
        orderBy: { filePath: 'asc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.parsedCodeFile.count({ where }),
    ]);

    res.status(200).json({
      files,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error('Get parsed files error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
