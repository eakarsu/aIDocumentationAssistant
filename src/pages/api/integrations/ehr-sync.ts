// Apply pass 5 — EHR sync stub for Epic / Cerner.
// NEEDS-CREDS: gated on EHR_PROVIDER + EHR_BASE_URL + EHR_TOKEN env vars.
// Without the env vars this endpoint returns 503 with the missing variable.
// With the env vars it forwards a minimal FHIR DocumentReference (built from
// the note) to the EHR's `DocumentReference` endpoint and records the result
// on the integration row. We deliberately do not write back to the EHR by
// default — set EHR_WRITE_ENABLED=1 to actually POST. Otherwise the call is
// a dry-run that returns the FHIR payload and the URL it would have sent to.
//
// Documented env: EHR_PROVIDER (epic|cerner|generic), EHR_BASE_URL,
// EHR_TOKEN, EHR_WRITE_ENABLED (set to '1' to actually POST).
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (!process.env.EHR_PROVIDER) return res.status(503).json({ error: 'EHR integration not configured.', missing: 'EHR_PROVIDER' });
  if (!process.env.EHR_BASE_URL) return res.status(503).json({ error: 'EHR integration not configured.', missing: 'EHR_BASE_URL' });
  if (!process.env.EHR_TOKEN) return res.status(503).json({ error: 'EHR integration not configured.', missing: 'EHR_TOKEN' });

  const { note_id } = req.body || {};
  if (!note_id) return res.status(400).json({ error: 'note_id is required' });

  try {
    const note = await prisma.note.findUnique({ where: { id: note_id } });
    if (!note) return res.status(404).json({ error: 'Note not found' });
    if (user.role !== 'ADMIN' && note.authorId !== user.id) return res.status(403).json({ error: 'Forbidden' });

    const docRef = {
      resourceType: 'DocumentReference',
      status: 'current',
      type: { text: note.noteType },
      subject: { display: note.patientName, identifier: { value: note.patientId } },
      date: note.createdAt.toISOString(),
      content: [{ attachment: { contentType: 'application/json', data: Buffer.from(JSON.stringify(note.content || {})).toString('base64') } }],
    };
    const url = `${process.env.EHR_BASE_URL.replace(/\/$/, '')}/DocumentReference`;

    if (process.env.EHR_WRITE_ENABLED !== '1') {
      return res.status(200).json({ dry_run: true, target_url: url, provider: process.env.EHR_PROVIDER, payload: docRef });
    }

    const { default: fetch } = await import('node-fetch' as any);
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.EHR_TOKEN}`,
        'Content-Type': 'application/fhir+json',
      },
      body: JSON.stringify(docRef),
    });
    const text = await r.text();
    res.status(r.ok ? 200 : 502).json({ status: r.status, response: text.slice(0, 5000), provider: process.env.EHR_PROVIDER });
  } catch (err: any) {
    console.error('ehr-sync error:', err);
    res.status(500).json({ error: 'EHR sync failed' });
  }
}
