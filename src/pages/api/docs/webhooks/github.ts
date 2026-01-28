import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

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

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
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

    if (!signature || !eventType) {
      return res.status(400).json({ error: 'Missing required headers' });
    }

    // Get repository from payload
    const repoFullName = payload.repository?.full_name;
    if (!repoFullName) {
      return res.status(400).json({ error: 'Missing repository information' });
    }

    const repository = await prisma.repository.findUnique({
      where: {
        provider_fullName: {
          provider: 'GITHUB',
          fullName: repoFullName,
        },
      },
    });

    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Verify webhook signature
    if (repository.webhookSecret) {
      const isValid = verifySignature(rawBody, signature, repository.webhookSecret);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Store webhook event
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        repositoryId: repository.id,
        eventType,
        payload,
        status: 'PENDING',
      },
    });

    // Process specific events
    if (eventType === 'push') {
      // Update last commit SHA
      const headCommit = payload.head_commit?.id;
      if (headCommit) {
        await prisma.repository.update({
          where: { id: repository.id },
          data: { lastCommitSha: headCommit },
        });
      }

      // Mark event as processing (actual processing would be done by a worker)
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: 'PROCESSING' },
      });
    }

    res.status(200).json({
      message: 'Webhook received',
      eventId: webhookEvent.id,
      eventType,
      deliveryId,
    });
  } catch (error) {
    console.error('GitHub webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
