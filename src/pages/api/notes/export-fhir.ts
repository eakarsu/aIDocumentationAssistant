// Apply pass 5 — FHIR export for a single note.
// PRODUCT-DECISION: emit a minimal FHIR R4 DocumentReference + Composition
// pair with the SOAP sections inline. Only standard fields are populated;
// the real Epic/Cerner integration is gated separately. This endpoint runs
// without external creds.
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const noteId = (req.query.note_id || req.body?.note_id) as string | undefined;
  if (!noteId) return res.status(400).json({ error: 'note_id is required' });

  try {
    const note = await prisma.note.findUnique({ where: { id: noteId } });
    if (!note) return res.status(404).json({ error: 'Note not found' });
    if (user.role !== 'ADMIN' && note.authorId !== user.id) return res.status(403).json({ error: 'Forbidden' });

    const content: any = note.content || {};
    const sections = ['subjective', 'objective', 'assessment', 'plan']
      .filter(k => content[k])
      .map(k => ({
        title: k.charAt(0).toUpperCase() + k.slice(1),
        code: { text: k },
        text: { status: 'generated', div: `<div xmlns="http://www.w3.org/1999/xhtml">${String(content[k]).slice(0, 5000)}</div>` },
      }));

    const composition = {
      resourceType: 'Composition',
      id: `composition-${note.id}`,
      status: note.status === 'SIGNED' ? 'final' : 'preliminary',
      type: { text: note.noteType },
      date: note.encounterDate.toISOString(),
      author: [{ display: `User-${note.authorId}` }],
      title: `${note.noteType} encounter for ${note.patientName}`,
      subject: { display: note.patientName, identifier: { value: note.patientId } },
      section: sections,
    };
    const docRef = {
      resourceType: 'DocumentReference',
      id: `docref-${note.id}`,
      status: 'current',
      type: { text: note.noteType },
      subject: { display: note.patientName, identifier: { value: note.patientId } },
      date: note.createdAt.toISOString(),
      content: [{ attachment: { contentType: 'application/json', data: Buffer.from(JSON.stringify(content)).toString('base64') } }],
    };
    const bundle = {
      resourceType: 'Bundle',
      type: 'collection',
      entry: [{ resource: composition }, { resource: docRef }],
    };
    res.setHeader('Content-Type', 'application/fhir+json');
    res.status(200).json(bundle);
  } catch (err: any) {
    console.error('export-fhir error:', err);
    res.status(500).json({ error: 'FHIR export failed' });
  }
}
