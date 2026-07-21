import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, getTenantContext, createAuditLog } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const tenant = await getTenantContext(req, user.id);
  if (!tenant) return res.status(403).json({ error: 'A valid x-tenant-id membership is required' });
  const id = String(req.query.id || '');
  const job = await prisma.governedToolJob.findFirst({
    where: { id, tenantId: tenant.tenantId },
    include: { aiRun: { include: { approval: true } } },
  });
  if (!job) return res.status(404).json({ error: 'Job not found' });

  if (req.method === 'GET') return res.status(200).json({ job });
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = String(req.body?.action || '').toUpperCase();
  const elevated = ['OWNER', 'ADMIN'].includes(tenant.role);
  if (!elevated && job.requestedById !== user.id && action !== 'APPROVE' && action !== 'REJECT') {
    return res.status(403).json({ error: 'Only the requester or a tenant administrator may change this job' });
  }

  try {
    if (action === 'CANCEL') {
      if (['COMPLETED', 'APPROVED', 'REJECTED', 'FAILED', 'DEAD_LETTER', 'CANCELLED'].includes(job.status)) {
        return res.status(409).json({ error: `Cannot cancel a ${job.status.toLowerCase()} job` });
      }
      const updated = await prisma.governedToolJob.update({
        where: { id },
        data: {
          cancelRequestedAt: new Date(),
          ...(['QUEUED', 'RETRY_WAIT', 'AWAITING_APPROVAL'].includes(job.status) ? { status: 'CANCELLED', completedAt: new Date() } : {}),
        },
      });
      await createAuditLog(user.id, 'UPDATE', 'GovernedToolJob', id, { status: job.status }, { action, status: updated.status }, req);
      return res.status(200).json({ job: updated });
    }

    if (action === 'RETRY') {
      if (!['FAILED', 'DEAD_LETTER'].includes(job.status)) return res.status(409).json({ error: 'Only terminal failed jobs can be retried' });
      const updated = await prisma.governedToolJob.update({
        where: { id },
        data: { status: 'QUEUED', attempt: 0, availableAt: new Date(), error: undefined, cancelRequestedAt: null, completedAt: null, leaseOwner: null, leaseExpiresAt: null },
      });
      await createAuditLog(user.id, 'UPDATE', 'GovernedToolJob', id, { status: job.status }, { action, status: updated.status }, req);
      return res.status(200).json({ job: updated });
    }

    if (action === 'APPROVE' || action === 'REJECT') {
      if (!['OWNER', 'ADMIN', 'REVIEWER'].includes(tenant.role)) return res.status(403).json({ error: 'Reviewer role required' });
      if (job.status !== 'AWAITING_APPROVAL' || !job.aiRun) return res.status(409).json({ error: 'Job is not awaiting approval' });
      if (req.body?.attestations?.sourcesReviewed !== true || req.body?.attestations?.outputSafe !== true) {
        return res.status(422).json({ error: 'sourcesReviewed and outputSafe attestations are required' });
      }
      const updated = await prisma.$transaction(async (tx) => {
        await tx.humanApproval.create({
          data: {
            tenantId: tenant.tenantId,
            aiRunId: job.aiRun!.id,
            reviewerId: user.id,
            status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
            attestations: req.body.attestations,
            comment: typeof req.body.comment === 'string' ? req.body.comment.slice(0, 4_000) : null,
            decidedAt: new Date(),
          },
        });
        return tx.governedToolJob.update({ where: { id }, data: { status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED', completedAt: new Date() } });
      });
      await createAuditLog(user.id, 'UPDATE', 'GovernedToolJob', id, { status: job.status }, { action, status: updated.status, outputDigest: job.aiRun.outputDigest }, req);
      return res.status(200).json({ job: updated });
    }

    return res.status(400).json({ error: 'action must be CANCEL, RETRY, APPROVE, or REJECT' });
  } catch (error: any) {
    return res.status(500).json({ error: 'JOB_UPDATE_FAILED', message: error?.message || 'Job update failed' });
  }
}
