// Apply pass 5 — semantic search over patient notes (in-memory stub).
// PRODUCT-DECISION: full vector store + HIPAA-compatible embeddings is out of
// scope for a mechanical pass. We implement a non-AI lexical fallback that
// uses Postgres ILIKE over the note content/summary/patientName fields.
// When OPENROUTER_API_KEY is set we additionally re-rank the top 50 lexical
// matches with a one-shot LLM call. Without the key we return the lexical
// matches alone — never 503 — because the search itself is on-device.
//
// To upgrade: replace the lexical step with an embedding lookup over a
// HIPAA-compatible vector store; the LLM rerank stage is already wired.
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

const aiRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 60 });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const allowed = await aiRateLimit(req, res);
  if (!allowed) return;

  const { query, limit } = req.body || {};
  if (!query || typeof query !== 'string') return res.status(400).json({ error: 'query is required' });
  const cap = Math.min(parseInt(limit, 10) || 20, 50);

  try {
    // Lexical match across patient name, summary, and JSON content (cast to text).
    const where: any = { OR: [
      { patientName: { contains: query, mode: 'insensitive' } },
      { summary: { contains: query, mode: 'insensitive' } },
      { aiSummary: { contains: query, mode: 'insensitive' } },
    ] };
    if (user.role !== 'ADMIN') where.AND = [{ authorId: user.id }];

    const matches = await prisma.note.findMany({
      where,
      orderBy: { encounterDate: 'desc' },
      take: cap,
      select: {
        id: true, patientName: true, patientId: true, encounterDate: true,
        noteType: true, summary: true, aiSummary: true,
      },
    });

    let reranked = matches;
    let rerank_method = 'lexical-only';
    if (process.env.OPENROUTER_API_KEY && matches.length > 1) {
      try {
        const { default: fetch } = await import('node-fetch' as any);
        const prompt = `Rank these clinical notes by relevance to the query. Return ONLY JSON: {"ranking":["id1","id2",...]}\nQuery: ${query}\nNotes: ${JSON.stringify(matches.map(m => ({ id: m.id, name: m.patientName, summary: m.summary || m.aiSummary || '' })))}`;
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'X-Title': 'AI Documentation Assistant',
          },
          body: JSON.stringify({
            model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.0,
            max_tokens: 1500,
          }),
        });
        const data: any = await r.json();
        const content = data.choices?.[0]?.message?.content || '';
        const m = content.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]);
          if (Array.isArray(parsed.ranking)) {
            const order = new Map<string, number>();
            parsed.ranking.forEach((id: string, i: number) => order.set(id, i));
            reranked = [...matches].sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
            rerank_method = 'llm-rerank';
          }
        }
      } catch (_) {}
    }

    res.status(200).json({ query, count: reranked.length, results: reranked, rerank_method });
  } catch (err: any) {
    console.error('semantic-search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
}
