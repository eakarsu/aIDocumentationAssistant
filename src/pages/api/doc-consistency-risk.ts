import type { NextApiRequest, NextApiResponse } from 'next';

type Finding = {
  field: string;
  severity: 'low' | 'medium' | 'high';
  detail: string;
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const notes = Array.isArray(req.body?.notes) ? req.body.notes : [];
  const findings: Finding[] = [];
  const statuses = new Set(notes.map((note: any) => String(note.status || '').toLowerCase()).filter(Boolean));
  const owners = new Set(notes.map((note: any) => String(note.owner || '').toLowerCase()).filter(Boolean));
  const unsignedFinals = notes.filter((note: any) => String(note.status || '').toLowerCase() === 'final' && !note.signedAt);

  if (statuses.has('draft') && statuses.has('final')) {
    findings.push({ field: 'status', severity: 'high', detail: 'Draft and final states are present in the same packet.' });
  }
  if (owners.size > 1) {
    findings.push({ field: 'owner', severity: 'medium', detail: 'Multiple note owners are referenced; confirm handoff ownership.' });
  }
  if (unsignedFinals.length > 0) {
    findings.push({ field: 'signature', severity: 'high', detail: `${unsignedFinals.length} final note(s) are missing signature timestamps.` });
  }

  const riskScore = Math.min(100, findings.reduce((total, finding) => {
    return total + (finding.severity === 'high' ? 34 : finding.severity === 'medium' ? 18 : 8);
  }, 0));

  return res.status(200).json({
    feature: 'doc_consistency_risk',
    riskScore,
    level: riskScore >= 68 ? 'critical' : riskScore >= 30 ? 'review' : 'clean',
    findings,
  });
}
