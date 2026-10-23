import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';
// @ts-ignore plain-JS helper module with adjacent .d.ts
import { toJsonExport, filterDocs } from '@/lib/featurePack.cjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const docs = await prisma.doc.findMany({
      where: user.role !== 'ADMIN' ? { authorId: user.id } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    const data = filterDocs(docs as unknown[], { search: String(req.query.search || ''), status: String(req.query.status || '') });
    await createAuditLog(user.id, 'EXPORT', 'Doc', 'json-export', null, { recordCount: data.length }, req);
    res.setHeader('Content-Disposition', 'attachment; filename="docs_export.json"');
    return res.status(200).json(toJsonExport(data));
  } catch (error) {
    console.error('JSON export error:', error);
    return res.status(500).json({ error: 'Export failed' });
  }
}
