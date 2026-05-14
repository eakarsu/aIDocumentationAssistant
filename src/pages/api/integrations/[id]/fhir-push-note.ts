import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';

/**
 * POST /api/integrations/:id/fhir-push-note
 * Body: { note_id: string }
 * Pushes a signed Note to the EHR as a FHIR DocumentReference resource.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  const { note_id } = req.body || {};
  if (!note_id) return res.status(400).json({ error: 'note_id is required' });

  try {
    const integration = await prisma.integration.findUnique({ where: { id: id as string } });
    if (!integration || integration.type !== 'EHR') return res.status(404).json({ error: 'EHR integration not found' });

    const config = (integration.configuration || {}) as any;
    const credentials = (integration.credentials || {}) as any;
    const baseUrl: string | undefined = config.baseUrl || config.fhirBaseUrl;
    if (!baseUrl) return res.status(400).json({ error: 'Integration.configuration.baseUrl is not set' });

    const note = await prisma.note.findUnique({ where: { id: note_id }, include: { author: true } });
    if (!note) return res.status(404).json({ error: 'Note not found' });
    if (user.role !== 'ADMIN' && note.authorId !== user.id) return res.status(403).json({ error: 'Forbidden' });

    if (!note.signedAt) return res.status(400).json({ error: 'Only signed notes can be pushed to EHR' });

    const docRef = {
      resourceType: 'DocumentReference',
      status: 'current',
      docStatus: 'final',
      type: { text: note.noteType },
      subject: { reference: `Patient/${note.patientId}`, display: note.patientName },
      date: note.signedAt,
      author: [{ display: `${note.author.firstName} ${note.author.lastName}` }],
      content: [
        {
          attachment: {
            contentType: 'application/json',
            data: Buffer.from(JSON.stringify(note.content)).toString('base64'),
            title: `Clinical Note: ${note.noteType}`,
          },
        },
      ],
      context: {
        period: { start: note.encounterDate },
      },
    };

    const url = `${baseUrl.replace(/\/$/, '')}/DocumentReference`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/fhir+json',
      'Accept': 'application/fhir+json',
    };
    if (credentials.accessToken || credentials.token) headers['Authorization'] = `Bearer ${credentials.accessToken || credentials.token}`;

    const log = await prisma.integrationSyncLog.create({
      data: { integrationId: integration.id, status: 'RUNNING', recordsSync: 0, startedAt: new Date() },
    });

    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(docRef) });
    if (!response.ok) {
      const text = await response.text();
      await prisma.integrationSyncLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', errors: { status: response.status, body: text.substring(0, 2000) }, completedAt: new Date() },
      });
      return res.status(502).json({ error: `FHIR upstream error ${response.status}`, detail: text.substring(0, 1000) });
    }
    const created = await response.json();

    await prisma.integrationSyncLog.update({
      where: { id: log.id },
      data: { status: 'COMPLETED', recordsSync: 1, completedAt: new Date() },
    });

    await createAuditLog(user.id, 'CREATE', 'Note', note.id, null, { fhirPush: { resourceId: created.id }, integrationId: integration.id }, req);

    res.status(200).json({ message: 'Note pushed', resourceId: created.id, raw: created });
  } catch (error: any) {
    console.error('FHIR push error:', error);
    res.status(500).json({ error: 'FHIR push failed', message: error?.message });
  }
}
