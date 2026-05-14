import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';

/**
 * POST /api/billing/:id/decision
 * Body: { decision: 'APPROVED'|'REJECTED'|'NEEDS_CORRECTION'|'IN_REVIEW', notes?: string }
 *
 * Access: ADMIN or BILLING.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!['ADMIN', 'BILLING'].includes(user.role)) return res.status(403).json({ error: 'Forbidden' });

  const { id } = req.query;
  const { decision, notes } = req.body || {};

  const VALID = new Set(['APPROVED', 'REJECTED', 'NEEDS_CORRECTION', 'IN_REVIEW']);
  if (!VALID.has(decision)) {
    return res.status(400).json({ error: `Invalid decision. Allowed: ${[...VALID].join(', ')}` });
  }

  try {
    const before = await prisma.billingReviewQueue.findUnique({ where: { id: id as string } });
    if (!before) return res.status(404).json({ error: 'Queue entry not found' });

    const updated = await prisma.billingReviewQueue.update({
      where: { id: id as string },
      data: {
        status: decision,
        notes: notes || null,
        reviewedBy: user.id,
        reviewedAt: new Date(),
      },
    });

    await createAuditLog(user.id, 'UPDATE', 'BillingReviewQueue', updated.id, before, { decision, notes }, req);

    res.status(200).json(updated);
  } catch (error: any) {
    console.error('Billing decision error:', error);
    res.status(500).json({ error: 'Failed to record decision', message: error?.message });
  }
}
