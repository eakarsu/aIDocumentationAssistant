import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { decrypt } from '@/lib/encryption';

const { enqueueJob } = require('@/lib/governance/runtime.cjs');

// Disable body parsing for raw body access
export const config = {
  api: {
    bodyParser: false,
  },
};

function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifySignature(payload: Buffer, signature: string, secret: string): boolean {
  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')}`;

  const supplied = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawBody = await getRawBody(req);
    const payload = JSON.parse(rawBody.toString());

    const signature = req.headers['x-hub-signature-256'] as string;
    const eventType = req.headers['x-github-event'] as string;
    const deliveryId = req.headers['x-github-delivery'] as string;

    if (!signature || !eventType || !deliveryId) {
      return res.status(400).json({ error: 'Missing required headers' });
    }

    // Get repository from payload
    const repoFullName = payload.repository?.full_name;
    if (!repoFullName) {
      return res.status(400).json({ error: 'Missing repository information' });
    }

    const repositoryId = String(req.query.repositoryId || '');
    if (!repositoryId) return res.status(400).json({ error: 'repositoryId query parameter is required' });
    const repository = await prisma.repository.findFirst({
      where: { id: repositoryId, provider: 'GITHUB', fullName: repoFullName },
    });

    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Verify webhook signature
    if (!repository.webhookSecret) return res.status(409).json({ error: 'Repository webhook secret is not configured' });
    const isValid = verifySignature(rawBody, signature, decrypt(repository.webhookSecret));
    if (!isValid) return res.status(401).json({ error: 'Invalid signature' });

    const duplicate = await prisma.webhookEvent.findUnique({
      where: { repositoryId_deliveryId: { repositoryId: repository.id, deliveryId } },
    });
    if (duplicate) return res.status(200).json({ message: 'Webhook already accepted', eventId: duplicate.id, eventType, deliveryId });

    // Store webhook event
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        repositoryId: repository.id,
        deliveryId,
        eventType,
        payload,
        status: 'PENDING',
      },
    });

    let syncJob = null;
    if (eventType === 'push') {
      const membership = await prisma.tenantMembership.findUnique({
        where: { tenantId_userId: { tenantId: repository.tenantId, userId: repository.createdById } },
      });
      if (!membership) return res.status(409).json({ error: 'Repository owner has no tenant membership' });
      syncJob = await enqueueJob(prisma, {
        tenantId: repository.tenantId,
        tenantRole: membership.role,
        userId: repository.createdById,
        body: {
          tenantId: repository.tenantId,
          repositoryId: repository.id,
          kind: 'REPOSITORY_SYNC',
          task: 'Incrementally synchronize permitted documentation sources and propagate deletions.',
          audience: 'documentation index',
          sourceIds: [],
          idempotencyKey: `github-delivery:${deliveryId}`,
          timeoutMs: 120000,
          costBudgetCents: 0,
          latencyBudgetMs: 120000,
          requireApproval: false,
        },
      });
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: 'COMPLETED', processedAt: new Date() },
      });
    }

    res.status(200).json({
      message: 'Webhook received',
      eventId: webhookEvent.id,
      eventType,
      deliveryId,
      syncJobId: syncJob?.id || null,
    });
  } catch (error) {
    console.error('GitHub webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
