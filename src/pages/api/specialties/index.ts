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
      const specialties = await prisma.specialty.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });

      res.status(200).json(specialties);
    } catch (error) {
      console.error('Get specialties error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const specialty = await prisma.specialty.create({
        data: { name, description },
      });

      await createAuditLog(user.id, 'CREATE', 'Specialty', specialty.id, null, specialty, req);

      res.status(201).json(specialty);
    } catch (error) {
      console.error('Create specialty error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
