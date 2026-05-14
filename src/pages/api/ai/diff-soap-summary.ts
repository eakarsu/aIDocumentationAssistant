// Apply pass 5 — diff-aware SOAP-note summary.
// PRODUCT-DECISION: "diff" semantics = compare two encounters by their
// SOAP-section text and ask the LLM to enumerate clinically meaningful
// changes (Subjective / Objective / Assessment / Plan). No structural diff
// algorithm — LLM is more useful for clinical reasoning across encounters.
// Returns 503 if OPENROUTER_API_KEY is missing.
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

const aiRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 30 });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const allowed = await aiRateLimit(req, res);
  if (!allowed) return;

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(503).json({ error: 'AI not configured: set OPENROUTER_API_KEY on the server.', missing: 'OPENROUTER_API_KEY' });
  }

  const { note_id_a, note_id_b } = req.body || {};
  if (!note_id_a || !note_id_b) return res.status(400).json({ error: 'note_id_a and note_id_b are required' });

  try {
    const [a, b] = await Promise.all([
      prisma.note.findUnique({ where: { id: note_id_a } }),
      prisma.note.findUnique({ where: { id: note_id_b } }),
    ]);
    if (!a || !b) return res.status(404).json({ error: 'One or both notes not found' });
    if (user.role !== 'ADMIN' && (a.authorId !== user.id || b.authorId !== user.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const prompt = `Compare two SOAP encounters for the same patient. Return ONLY JSON:
{"changes":{"subjective":["..."],"objective":["..."],"assessment":["..."],"plan":["..."]},"trajectory":"improving|stable|worsening|mixed","key_clinical_changes":["..."],"new_problems":["..."],"resolved_problems":["..."],"summary":"..."}
Encounter A (${a.encounterDate}): ${JSON.stringify(a.content).slice(0, 4000)}
Encounter B (${b.encounterDate}): ${JSON.stringify(b.content).slice(0, 4000)}`;

    const { default: fetch } = await import('node-fetch' as any);
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Title': 'AI Documentation Assistant',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022',
        messages: [
          { role: 'system', content: 'You are a clinical documentation assistant. Return ONLY valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 3000,
      }),
    });
    const data: any = await r.json();
    if (data.error) return res.status(502).json({ error: data.error.message || 'AI error' });
    const content = data.choices?.[0]?.message?.content || '';
    const m = content.match(/\{[\s\S]*\}/);
    let parsed: any = null;
    if (m) { try { parsed = JSON.parse(m[0]); } catch (_) {} }
    res.status(200).json({ result: parsed || { raw: content }, encounter_a: { id: a.id, date: a.encounterDate }, encounter_b: { id: b.id, date: b.encounterDate } });
  } catch (err: any) {
    console.error('diff-soap-summary error:', err);
    res.status(500).json({ error: 'Diff summary failed' });
  }
}
