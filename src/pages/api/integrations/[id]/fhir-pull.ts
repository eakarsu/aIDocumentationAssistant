import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';

/**
 * POST /api/integrations/:id/fhir-pull
 * Body: { resourceType: 'Patient'|'Encounter'|'Observation', patientId?: string }
 * Calls the FHIR R4 server defined on the Integration.configuration.baseUrl
 * Uses Bearer token from Integration.credentials.accessToken
 *
 * Persists each pulled resource as an IntegrationSyncLog entry.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  const { resourceType = 'Patient', patientId } = req.body || {};

  const ALLOWED = new Set(['Patient', 'Encounter', 'Observation', 'Condition', 'Procedure', 'MedicationRequest']);
  if (!ALLOWED.has(resourceType)) {
    return res.status(400).json({ error: `Unsupported FHIR resourceType. Allowed: ${[...ALLOWED].join(', ')}` });
  }

  try {
    const integration = await prisma.integration.findUnique({ where: { id: id as string } });
    if (!integration) return res.status(404).json({ error: 'Integration not found' });
    if (integration.type !== 'EHR') return res.status(400).json({ error: 'Integration must be of type EHR' });

    const config = (integration.configuration || {}) as any;
    const credentials = (integration.credentials || {}) as any;

    const baseUrl: string | undefined = config.baseUrl || config.fhirBaseUrl;
    if (!baseUrl) return res.status(400).json({ error: 'Integration.configuration.baseUrl is not set' });

    const token: string | undefined = credentials.accessToken || credentials.token;
    const headers: Record<string, string> = { 'Accept': 'application/fhir+json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let url = `${baseUrl.replace(/\/$/, '')}/${resourceType}`;
    if (patientId && resourceType !== 'Patient') {
      url += `?patient=${encodeURIComponent(patientId)}`;
    } else if (patientId && resourceType === 'Patient') {
      url += `/${encodeURIComponent(patientId)}`;
    }

    const log = await prisma.integrationSyncLog.create({
      data: {
        integrationId: integration.id,
        status: 'RUNNING',
        recordsSync: 0,
        startedAt: new Date(),
      },
    });

    const response = await fetch(url, { headers });
    if (!response.ok) {
      const text = await response.text();
      await prisma.integrationSyncLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', errors: { status: response.status, body: text.substring(0, 2000) }, completedAt: new Date() },
      });
      return res.status(502).json({ error: `FHIR upstream error ${response.status}`, detail: text.substring(0, 1000) });
    }

    const data = await response.json();
    let count = 0;
    if (data.resourceType === 'Bundle' && Array.isArray(data.entry)) count = data.entry.length;
    else if (data.resourceType) count = 1;

    await prisma.integrationSyncLog.update({
      where: { id: log.id },
      data: { status: 'COMPLETED', recordsSync: count, completedAt: new Date() },
    });

    await prisma.integration.update({
      where: { id: integration.id },
      data: { lastSyncAt: new Date(), status: 'ACTIVE' },
    });

    await createAuditLog(user.id, 'READ', 'Integration', integration.id, null, { fhirPull: { resourceType, patientId, count } }, req);

    res.status(200).json({
      integrationId: integration.id,
      resourceType,
      count,
      data,
    });
  } catch (error: any) {
    console.error('FHIR pull error:', error);
    res.status(500).json({ error: 'FHIR pull failed', message: error?.message });
  }
}
