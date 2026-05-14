// Live code-to-docs sync — GitHub webhook already wired. This endpoint
// receives a list of changed files and (re)generates a markdown summary
// for each, persisting under the related Doc record.
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

const aiRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 30 });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY; // TODO: configure credentials
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const allowed = await aiRateLimit(req, res);
  if (!allowed) return;

  const { changes, repo } = req.body || {};
  if (!Array.isArray(changes) || changes.length === 0) {
    return res.status(400).json({ error: 'changes[] is required' });
  }

  try {
    const updates: any[] = [];
    for (const c of changes.slice(0, 25)) {
      const { path, snippet } = c || {};
      if (!path || typeof path !== 'string') continue;
      let regenSummary = `Stub summary for ${path} (no LLM key)`;
      if (OPENROUTER_API_KEY) {
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: OPENROUTER_MODEL,
            messages: [
              { role: 'system', content: 'Generate concise markdown docs (under 200 words) for the provided source snippet. Return plain markdown.' },
              { role: 'user', content: `File: ${path}\n\n${(snippet || '').slice(0, 4000)}` },
            ],
          }),
        });
        if (r.ok) {
          const j: any = await r.json();
          regenSummary = j?.choices?.[0]?.message?.content || regenSummary;
        }
      }

      // Persist as a Doc if such a model exists; otherwise return inline.
      let doc: any = null;
      try {
        doc = await (prisma as any).doc?.upsert({
          where: { sourcePath: path },
          update: { content: regenSummary, updatedAt: new Date() },
          create: { sourcePath: path, content: regenSummary, authorId: user.id, repo: repo || null },
        });
      } catch {
        // Doc model may not have sourcePath; ignore persistence in v0.
      }
      updates.push({ path, summary: regenSummary, docId: doc?.id });
    }

    return res.status(200).json({ repo: repo || null, count: updates.length, updates });
  } catch (e: any) {
    console.error('code-docs-sync error:', e);
    return res.status(500).json({ error: 'sync failed', detail: e?.message });
  }
}
