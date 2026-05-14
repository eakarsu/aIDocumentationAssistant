// RAG over clinical templates — retrieve specialty-specific phrasing and use
// it as a few-shot context for SOAP drafting. v0: lexical retrieval over the
// existing Template model + a single LLM rewrite call. No vector store yet.
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

  const { specialty, draft, top_k } = req.body || {};
  if (!specialty || typeof specialty !== 'string') {
    return res.status(400).json({ error: 'specialty is required' });
  }
  if (!draft || typeof draft !== 'string') {
    return res.status(400).json({ error: 'draft text is required' });
  }
  const k = Math.min(parseInt(top_k, 10) || 3, 8);

  try {
    // Lexical retrieval: find templates whose name/specialty matches.
    const templates = await prisma.template.findMany({
      where: {
        OR: [
          { name: { contains: specialty, mode: 'insensitive' } },
          { description: { contains: specialty, mode: 'insensitive' } },
        ],
      },
      take: k,
      orderBy: { updatedAt: 'desc' },
    });

    const fewShot = templates
      .map((t: any, i: number) => `Example ${i + 1} (${t.name}):\n${JSON.stringify(t.sections || {}).slice(0, 800)}`)
      .join('\n\n');

    if (!OPENROUTER_API_KEY) {
      return res.status(200).json({
        specialty,
        retrieved: templates.map((t: any) => ({ id: t.id, name: t.name })),
        rewrite: null,
        notice: 'OPENROUTER_API_KEY missing; returning retrieved templates only',
      });
    }

    const messages = [
      { role: 'system', content: 'You are a clinical scribe assistant. Rewrite the user draft into SOAP using the style of provided specialty templates. Return JSON {"soap": {"S": "...", "O": "...", "A": "...", "P": "..."}}.' },
      { role: 'user', content: `Specialty: ${specialty}\n\nTemplates:\n${fewShot}\n\nDraft:\n${draft}` },
    ];

    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: OPENROUTER_MODEL, messages, response_format: { type: 'json_object' } }),
    });
    if (!r.ok) {
      return res.status(502).json({ error: 'LLM call failed', status: r.status });
    }
    const j: any = await r.json();
    const content = j?.choices?.[0]?.message?.content || '{}';
    let rewrite: any;
    try { rewrite = JSON.parse(content); } catch { rewrite = { raw: content }; }

    return res.status(200).json({
      specialty,
      retrieved: templates.map((t: any) => ({ id: t.id, name: t.name })),
      rewrite,
    });
  } catch (e: any) {
    console.error('rag-clinical-templates error:', e);
    return res.status(500).json({ error: 'RAG failed', detail: e?.message });
  }
}
