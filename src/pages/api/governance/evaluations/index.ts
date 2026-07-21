import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, getTenantContext, createAuditLog } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const tenant = await getTenantContext(req, user.id);
  if (!tenant) return res.status(403).json({ error: 'A valid x-tenant-id membership is required' });

  if (req.method === 'GET') {
    const cases = await prisma.evaluationCase.findMany({
      where: { tenantId: tenant.tenantId },
      include: { runs: { orderBy: { createdAt: 'desc' }, take: 10 } },
      orderBy: { updatedAt: 'desc' },
    });
    return res.status(200).json({ cases });
  }

  if (req.method === 'POST') {
    if (!['OWNER', 'ADMIN', 'REVIEWER'].includes(tenant.role)) return res.status(403).json({ error: 'Reviewer role required' });
    const { name, toolName, input, expected, rubric } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || name.length > 300 || typeof toolName !== 'string' || !toolName.trim()) {
      return res.status(400).json({ error: 'A bounded name and toolName are required' });
    }
    if (!input || typeof input !== 'object' || !expected || typeof expected !== 'object' || !rubric || typeof rubric !== 'object') {
      return res.status(400).json({ error: 'input, expected, and rubric objects are required' });
    }
    const evaluationCase = await prisma.evaluationCase.create({
      data: { tenantId: tenant.tenantId, name: name.trim(), toolName: toolName.trim(), input, expected, rubric },
    });
    await createAuditLog(user.id, 'CREATE', 'EvaluationCase', evaluationCase.id, null, { name: evaluationCase.name, toolName: evaluationCase.toolName }, req);
    return res.status(201).json({ evaluationCase });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
