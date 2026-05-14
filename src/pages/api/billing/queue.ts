import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

/**
 * GET /api/billing/queue
 * Paginated list of items in the billing review queue.
 * Query: status, page, limit, search (matches patient name)
 *
 * Access: ADMIN or BILLING role only.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!['ADMIN', 'BILLING'].includes(user.role)) return res.status(403).json({ error: 'Forbidden' });

  const { status, search, page = '1', limit = '20' } = req.query;

  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
  const skip = (pageNum - 1) * limitNum;

  const where: any = {};
  if (status) where.status = status;

  try {
    if (search) {
      where.note = { patientName: { contains: search as string, mode: 'insensitive' } };
    }

    const [rows, total] = await Promise.all([
      prisma.billingReviewQueue.findMany({
        where,
        include: {
          note: {
            select: {
              id: true, patientId: true, patientName: true, encounterDate: true, noteType: true,
              author: { select: { firstName: true, lastName: true } },
              medicalCodes: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.billingReviewQueue.count({ where }),
    ]);

    res.status(200).json({
      data: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Billing queue error:', error);
    res.status(500).json({ error: 'Failed to load billing queue', message: error?.message });
  }
}
