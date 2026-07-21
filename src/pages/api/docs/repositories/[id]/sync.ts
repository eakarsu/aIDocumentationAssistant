import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, getTenantContext } from '@/lib/auth';

const { enqueueJob } = require('@/lib/governance/runtime.cjs');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const tenant = await getTenantContext(req, user.id);
  if (!tenant) return res.status(403).json({ error: 'A valid x-tenant-id membership is required' });
  const repositoryId = String(req.query.id || '');
  const idempotencyHeader = req.headers['idempotency-key'];
  const idempotencyKey = Array.isArray(idempotencyHeader) ? idempotencyHeader[0] : idempotencyHeader;
  if (!idempotencyKey) return res.status(400).json({ error: 'Idempotency-Key header is required' });

  try {
    const job = await enqueueJob(prisma, {
      tenantId: tenant.tenantId,
      tenantRole: tenant.role,
      userId: user.id,
      body: {
        tenantId: tenant.tenantId,
        repositoryId,
        kind: 'REPOSITORY_SYNC',
        task: 'Incrementally synchronize permitted documentation sources and propagate deletions.',
        audience: 'documentation index',
        sourceIds: [],
        idempotencyKey: `repository-sync:${repositoryId}:${idempotencyKey}`,
        timeoutMs: 120000,
        costBudgetCents: 0,
        latencyBudgetMs: 120000,
        requireApproval: false,
      },
    });
    return res.status(202).json({ message: 'Repository sync queued', jobId: job.id, status: job.status, traceId: job.traceId });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error?.code || 'SYNC_QUEUE_FAILED', message: error?.message || 'Unable to queue sync', retryable: Boolean(error?.retryable) });
  }
}
