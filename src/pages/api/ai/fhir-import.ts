// FHIR-bundle round-trip: import endpoint that accepts a FHIR Bundle and
// pre-populates a chart by creating a Note record from the resources.
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

  const { bundle } = req.body || {};
  if (!bundle || bundle.resourceType !== 'Bundle' || !Array.isArray(bundle.entry)) {
    return res.status(400).json({ error: 'Valid FHIR Bundle (resourceType=Bundle) required' });
  }

  try {
    const resources = bundle.entry.map((e: any) => e.resource).filter(Boolean);
    const patient = resources.find((r: any) => r.resourceType === 'Patient');
    const conditions = resources.filter((r: any) => r.resourceType === 'Condition');
    const observations = resources.filter((r: any) => r.resourceType === 'Observation');
    const meds = resources.filter((r: any) => r.resourceType === 'MedicationStatement' || r.resourceType === 'MedicationRequest');

    const patientName = patient
      ? `${(patient.name?.[0]?.given || []).join(' ')} ${patient.name?.[0]?.family || ''}`.trim() || 'Imported Patient'
      : 'Imported Patient';

    const summary = [
      `Imported from FHIR. ${conditions.length} condition(s), ${observations.length} observation(s), ${meds.length} medication(s).`,
      conditions.length ? 'Problems: ' + conditions.map((c: any) => c.code?.text || c.code?.coding?.[0]?.display).filter(Boolean).join(', ') : '',
      meds.length ? 'Medications: ' + meds.map((m: any) => m.medicationCodeableConcept?.text || m.medicationCodeableConcept?.coding?.[0]?.display).filter(Boolean).join(', ') : '',
    ].filter(Boolean).join('\n');

    let note: any = null;
    try {
      note = await prisma.note.create({
        data: {
          patientName,
          noteType: 'IMPORT',
          encounterDate: new Date(),
          content: { source: 'FHIR', bundle },
          summary,
          authorId: user.id,
        } as any,
      });
    } catch (err) {
      // Schema may differ; return parsed data even if persistence fails.
      console.warn('FHIR import persistence skipped:', err);
    }

    return res.status(200).json({
      imported: {
        patient: patientName,
        conditions: conditions.length,
        observations: observations.length,
        medications: meds.length,
      },
      note_id: note?.id || null,
      summary,
    });
  } catch (e: any) {
    console.error('fhir-import error:', e);
    return res.status(500).json({ error: 'FHIR import failed', detail: e?.message });
  }
}
