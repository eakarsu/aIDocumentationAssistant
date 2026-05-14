// Voice-driven coding: combine recordings/transcribe + ai/billing-codes into
// a single endpoint. Takes a recording_id, fetches transcript, asks the LLM
// to suggest CPT/ICD-10 codes, persists candidates.
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { suggestMedicalCodes } from '@/lib/ai-service';

const aiRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 20 });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const allowed = await aiRateLimit(req, res);
  if (!allowed) return;

  const { recording_id, transcript, note_id } = req.body || {};
  if (!recording_id && !transcript) {
    return res.status(400).json({ error: 'recording_id or transcript required' });
  }

  try {
    let text = typeof transcript === 'string' ? transcript : '';
    if (!text && recording_id) {
      const rec: any = await (prisma as any).recording?.findUnique?.({ where: { id: recording_id } });
      if (!rec) return res.status(404).json({ error: 'Recording not found' });
      if (user.role !== 'ADMIN' && rec.authorId && rec.authorId !== user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      text = rec.transcript || rec.text || '';
      if (!text) return res.status(400).json({ error: 'Recording has no transcript yet' });
    }

    const suggestions = await suggestMedicalCodes({ transcript: text });

    // Persist when a note_id is provided.
    const persisted: any[] = [];
    if (note_id && Array.isArray(suggestions)) {
      for (const s of suggestions.slice(0, 25)) {
        try {
          const row = await prisma.medicalCode.create({
            data: {
              noteId: note_id,
              code: s.code,
              codeType: s.codeType,
              description: s.description,
              confidence: s.confidence ?? null,
              isVerified: false,
            } as any,
          });
          persisted.push(row);
        } catch (e) {
          // skip duplicates / model mismatch
        }
      }
    }

    return res.status(200).json({
      recording_id: recording_id || null,
      note_id: note_id || null,
      transcript_excerpt: text.slice(0, 300),
      suggestions,
      persisted_count: persisted.length,
    });
  } catch (e: any) {
    console.error('voice-coding error:', e);
    return res.status(500).json({ error: 'voice coding failed', detail: e?.message });
  }
}
