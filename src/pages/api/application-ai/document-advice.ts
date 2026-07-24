import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

const REQUIRED_BASE_URL = 'https://openrouter.ai/api/v1';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (prompt.length < 10 || prompt.length > 5000) return res.status(400).json({ error: 'Prompt length is invalid' });
  if (!process.env.OPENROUTER_API_KEY) return res.status(503).json({ error: 'OPENROUTER_API_KEY is required' });
  if (!process.env.OPENROUTER_MODEL) return res.status(503).json({ error: 'OPENROUTER_MODEL is required' });
  if (process.env.OPENROUTER_BASE_URL !== REQUIRED_BASE_URL) return res.status(503).json({ error: 'OPENROUTER_BASE_URL must use the configured OpenRouter API' });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(process.env.OPENROUTER_TIMEOUT_MS || 120000));
    let providerResponse: Response;
    try {
      providerResponse = await fetch(`${REQUIRED_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1',
          'X-Title': 'AI Documentation Assistant',
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL,
          messages: [
            { role: 'system', content: 'You are a software documentation assistant. Give concise, actionable guidance with explicit assumptions, source/provenance needs, security considerations, and reviewer checkpoints. Do not invent repository facts.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 700,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    const payload: any = await providerResponse.json().catch(() => null);
    if (!providerResponse.ok) return res.status(502).json({ error: `OpenRouter request failed with status ${providerResponse.status}` });
    const advice = payload?.choices?.[0]?.message?.content?.trim();
    if (!advice) return res.status(502).json({ error: 'OpenRouter returned no documentation advice' });
    const stored = await prisma.runtimeAiResult.create({
      data: {
        userId: user.id,
        prompt,
        model: process.env.OPENROUTER_MODEL,
        providerReceipt: { id: payload.id || null },
        result: advice,
        usage: payload.usage || {},
      },
    });
    return res.status(200).json({ id: stored.id, advice, model: stored.model, createdAt: stored.createdAt });
  } catch (error: any) {
    console.error('Documentation advice failed:', error?.message);
    return res.status(502).json({ error: 'Documentation advice request failed' });
  }
}
