import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getCurrentUser(req);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const memberships = await prisma.tenantMembership.findMany({
      where: { userId: user.id },
      select: { tenantId: true, role: true, tenant: { select: { name: true, slug: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.status(200).json({ user, memberships });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
