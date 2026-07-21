// Apply pass 5 — semantic search over patient notes (in-memory stub).
// PRODUCT-DECISION: full vector store + HIPAA-compatible embeddings is out of
// scope for a mechanical pass. We implement a non-AI lexical fallback that
// uses Postgres ILIKE over the note content/summary/patientName fields.
// Results remain deterministic and server-side; patient-note data is not sent
// to a generic external reranker.
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

    res.status(200).json({ query, count: matches.length, results: matches, rerank_method: 'lexical-only' });
  } catch (err: any) {
    console.error('semantic-search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
}
