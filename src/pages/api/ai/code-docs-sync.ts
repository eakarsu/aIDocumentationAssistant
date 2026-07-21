// Compatibility endpoint for the former inline prompt wrapper. Documentation
// generation now runs through the same typed, grounded, durable job contract as
// /api/governance/jobs; raw snippets are intentionally not accepted.
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, getTenantContext } from '@/lib/auth';

const { enqueueJob } = require('@/lib/governance/runtime.cjs');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const tenant = await getTenantContext(req, user.id);
  if (!tenant) return res.status(403).json({ error: 'A valid x-tenant-id membership is required' });
  const idempotencyHeader = req.headers['idempotency-key'];
  const idempotencyKey = Array.isArray(idempotencyHeader) ? idempotencyHeader[0] : idempotencyHeader;
  if (!idempotencyKey) return res.status(400).json({ error: 'Idempotency-Key header is required' });

  const { repositoryId, task, sourceIds = [], audience = 'repository maintainers' } = req.body || {};
  if (typeof repositoryId !== 'string' || typeof task !== 'string') {
    return res.status(400).json({ error: 'repositoryId and task are required; inline changes/snippets are no longer accepted' });
  }
  try {
    const job = await enqueueJob(prisma, {
      tenantId: tenant.tenantId,
      tenantRole: tenant.role,
      userId: user.id,
      body: {
        repositoryId,
        kind: 'UPDATE_README',
        task,
        audience,
        sourceIds,
        idempotencyKey: `code-docs-sync:${idempotencyKey}`,
        requireApproval: true,
      },
    });
    return res.status(202).json({ jobId: job.id, status: job.status, traceId: job.traceId });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error?.code || 'QUEUE_FAILED', message: error?.message || 'Unable to queue documentation job', retryable: Boolean(error?.retryable) });
  }
}
