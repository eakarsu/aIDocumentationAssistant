import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, getTenantContext } from '@/lib/auth';

const { enqueueJob } = require('@/lib/governance/runtime.cjs');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const tenant = await getTenantContext(req, user.id);
  if (!tenant) return res.status(403).json({ error: 'A valid x-tenant-id membership is required' });

  try {
    if (req.method === 'GET') {
      const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '25'), 10)));
      const jobs = await prisma.governedToolJob.findMany({
        where: { tenantId: tenant.tenantId },
        select: {
          id: true, repositoryId: true, requestedById: true, kind: true, status: true, attempt: true, maxAttempts: true,
          error: true, traceId: true, availableAt: true, startedAt: true, completedAt: true, createdAt: true, updatedAt: true,
          aiRun: { select: { id: true, gateDecision: true, qualityScore: true, safetyScore: true, costCents: true, latencyMs: true, citations: true, createdAt: true, approval: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return res.status(200).json({ jobs });
    }

    if (req.method === 'POST') {
      const job = await enqueueJob(prisma, {
        tenantId: tenant.tenantId,
        tenantRole: tenant.role,
        userId: user.id,
        body: req.body,
      });
      return res.status(202).json({ job });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error?.code || 'INTERNAL_ERROR', message: error?.message || 'Internal server error', retryable: Boolean(error?.retryable) });
  }
}
