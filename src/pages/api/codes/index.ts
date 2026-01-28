import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const { codeType, search, category, page = '1', limit = '50' } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

      const where: any = { isActive: true };

      if (codeType) {
        where.codeType = codeType;
      }

      if (category) {
        where.category = category;
      }

      if (search) {
        where.OR = [
          { code: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const [codes, total] = await Promise.all([
        prisma.codeReference.findMany({
          where,
          skip,
          take: parseInt(limit as string),
          orderBy: { code: 'asc' },
        }),
        prisma.codeReference.count({ where }),
      ]);

      res.status(200).json({
        codes,
        pagination: {
          total,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          totalPages: Math.ceil(total / parseInt(limit as string)),
        },
      });
    } catch (error) {
      console.error('Get codes error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
