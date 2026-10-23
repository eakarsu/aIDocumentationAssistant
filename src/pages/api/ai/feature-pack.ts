import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
// @ts-ignore plain-JS helper module with adjacent .d.ts
import { docCompleteness, staleDocs, publishReadiness } from '@/lib/featurePack.cjs';

const FEATURES = ['doc-completeness', 'stale-docs', 'publish-readiness'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const feature = String(req.body?.feature || '');
  if (!FEATURES.includes(feature)) return res.status(400).json({ error: `Choose a supported feature: ${FEATURES.join(', ')}` });
  try {
    const docs = await prisma.doc.findMany({
      where: user.role !== 'ADMIN' ? { authorId: user.id } : undefined,
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    const fallback = () =>
      feature === 'doc-completeness'
        ? docCompleteness((docs as unknown[]).find((d: unknown) => (d as { id: string }).id === req.body?.docId) || docs[0] || {})
        : feature === 'stale-docs'
          ? staleDocs(docs as unknown[])
          : publishReadiness(docs as unknown[]);
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(200).json(fallback());
    try {
      const fb = fallback() as Record<string, unknown>;
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Title': 'AI Documentation Assistant' },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022',
          messages: [
            { role: 'system', content: 'You are a documentation assistant. Improve this deterministic summary of the user\'s own documents. Return JSON only with title, summary, items (array of strings), cautions (array of strings). Do not invent document facts beyond the supplied summary.' },
            { role: 'user', content: JSON.stringify(fb) },
          ],
          temperature: 0.2, max_tokens: 700,
        }),
      });
      const payload: { choices?: { message?: { content?: string } }[]; model?: string } = await response.json().catch(() => ({}));
      const content = payload?.choices?.[0]?.message?.content?.trim();
      if (!response.ok || !content) return res.status(200).json(fallback());
      return res.status(200).json({ aiGenerated: true, feature, output: JSON.parse(content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')), model: payload.model });
    } catch {
      return res.status(200).json(fallback());
    }
  } catch (error) {
    console.error('Feature-pack AI failed:', error instanceof Error ? error.message : 'unknown');
    return res.status(500).json({ error: 'Feature request failed' });
  }
}
