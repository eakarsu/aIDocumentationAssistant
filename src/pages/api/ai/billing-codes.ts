import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

const aiRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 20 });

interface BillingCodeEntry {
  code: string;
  codeType: string;
  description: string;
  confidence: number | null;
  isVerified: boolean;
  verifiedBy: string | null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const allowed = await aiRateLimit(req, res);
  if (!allowed) return;

  const { note_id } = req.body;

  if (!note_id || typeof note_id !== 'string') {
    return res.status(400).json({ error: 'note_id is required' });
  }

  try {
    // Fetch the note with its existing medical codes
    const note = await prisma.note.findUnique({
      where: { id: note_id },
      include: {
        medicalCodes: {
          orderBy: { confidence: 'desc' },
        },
        billingReviewQueue: true,
      },
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Check access: non-admins can only access their own notes
    if (user.role !== 'ADMIN' && note.authorId !== user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Format codes for billing review
    const cptCodes: BillingCodeEntry[] = [];
    const icd10Codes: BillingCodeEntry[] = [];
    const otherCodes: BillingCodeEntry[] = [];

    for (const code of note.medicalCodes) {
      const entry: BillingCodeEntry = {
        code: code.code,
        codeType: code.codeType,
        description: code.description,
        confidence: code.confidence,
        isVerified: code.isVerified,
        verifiedBy: code.verifiedBy,
      };

      if (code.codeType === 'CPT') {
        cptCodes.push(entry);
      } else if (code.codeType === 'ICD10') {
        icd10Codes.push(entry);
      } else {
        otherCodes.push(entry);
      }
    }

    // Create or find BillingReviewQueue entry
    let billingQueue = note.billingReviewQueue;
    if (!billingQueue) {
      billingQueue = await prisma.billingReviewQueue.create({
        data: {
          noteId: note_id,
          status: 'PENDING',
        },
      });
    }

    res.status(200).json({
      note_id,
      patient_name: note.patientName,
      encounter_date: note.encounterDate,
      note_type: note.noteType,
      billing_review: {
        queue_id: billingQueue.id,
        status: billingQueue.status,
        reviewed_by: billingQueue.reviewedBy,
        reviewed_at: billingQueue.reviewedAt,
        created_at: billingQueue.createdAt,
      },
      codes: {
        cpt: cptCodes,
        icd10: icd10Codes,
        other: otherCodes,
        total: note.medicalCodes.length,
      },
      summary: {
        total_codes: note.medicalCodes.length,
        verified_codes: note.medicalCodes.filter(c => c.isVerified).length,
        pending_verification: note.medicalCodes.filter(c => !c.isVerified).length,
        high_confidence: note.medicalCodes.filter(c => c.confidence !== null && c.confidence >= 0.8).length,
      },
    });
  } catch (error) {
    console.error('Billing codes error:', error);
    res.status(500).json({ error: 'Failed to retrieve billing codes' });
  }
}
