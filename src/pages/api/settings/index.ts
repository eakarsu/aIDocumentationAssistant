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
      const settings = await prisma.systemSetting.findMany();
      const settingsMap = settings.reduce((acc, s) => {
        acc[s.key] = s.value;
        return acc;
      }, {} as Record<string, string>);

      res.status(200).json(settingsMap);
    } catch (error) {
      console.error('Get settings error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      const updates = req.body;

      for (const [key, value] of Object.entries(updates)) {
        await prisma.systemSetting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        });
      }

      await createAuditLog(user.id, 'UPDATE', 'SystemSetting', 'bulk', null, updates, req);

      const settings = await prisma.systemSetting.findMany();
      const settingsMap = settings.reduce((acc, s) => {
        acc[s.key] = s.value;
        return acc;
      }, {} as Record<string, string>);

      res.status(200).json(settingsMap);
    } catch (error) {
      console.error('Update settings error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
