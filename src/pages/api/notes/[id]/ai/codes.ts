import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';
import { suggestMedicalCodes } from '@/lib/ai-service';
import { CodeType } from '@prisma/client';
import { rateLimit } from '@/lib/rate-limit';

const aiRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 20 });

// Normalize AI-returned code types to valid enum values
function normalizeCodeType(codeType: string): CodeType {
  const normalized = codeType.toUpperCase().replace(/-/g, '').replace(/ /g, '');
  if (normalized === 'ICD10' || normalized === 'ICD10CM' || normalized === 'ICD10PCS') {
    return 'ICD10';
  }
  if (normalized === 'CPT' || normalized === 'CPT4') {
    return 'CPT';
  }
  if (normalized === 'HCPCS') {
    return 'HCPCS';
  }
  if (normalized === 'SNOMED' || normalized === 'SNOMEDCT') {
    return 'SNOMED';
  }
  // Default to CPT if unknown
  return 'CPT';
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

  const { id } = req.query;

  try {
    const note = await prisma.note.findUnique({
      where: { id: id as string },
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const codes = await suggestMedicalCodes(note.content as object);

    // Store suggested codes with normalized code types
    for (const code of codes) {
      const normalizedCodeType = normalizeCodeType(code.codeType);
      await prisma.medicalCode.create({
        data: {
          noteId: id as string,
          codeType: normalizedCodeType,
          code: code.code,
          description: code.description,
          confidence: code.confidence,
          isVerified: false,
        },
      });
    }

    // Update note with AI codes
    await prisma.note.update({
      where: { id: id as string },
      data: {
        aiCodes: codes as any,
      },
    });

    await createAuditLog(user.id, 'UPDATE', 'Note', id as string, null, { aiAction: 'coding' }, req);

    res.status(200).json({ codes });
  } catch (error) {
    console.error('AI coding error:', error);
    res.status(500).json({ error: 'Failed to suggest medical codes' });
  }
}
