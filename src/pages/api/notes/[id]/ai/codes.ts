import {withAiRequest,aiFailureStatus} from '@/lib/ai-request';
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
      include:{coSignatures:{select:{signerId:true}}},
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    if(user.role!=='ADMIN'&&note.authorId!==user.id&&!note.coSignatures.some(signature=>signature.signerId===user.id))return res.status(403).json({error:'Access denied'});
    await withAiRequest(req,res,async signal=>{

    const codes = await suggestMedicalCodes(note.content as object,signal);

    // Store suggested codes with normalized code types
    await prisma.$transaction(async tx=>{signal.throwIfAborted();for (const code of codes) {
      const normalizedCodeType = normalizeCodeType(code.codeType);
      await tx.medicalCode.create({
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
    await tx.note.update({
      where: { id: id as string },
      data: {
        aiCodes: codes as any,
        aiResults: {
          ...(note.aiResults && typeof note.aiResults === 'object' && !Array.isArray(note.aiResults) ? note.aiResults : {}),
          codes: { codes },
        } as any,
      },
    });signal.throwIfAborted();});

    signal.throwIfAborted();await createAuditLog(user.id, 'UPDATE', 'Note', id as string, null, { aiAction: 'coding' }, req);

    signal.throwIfAborted();res.status(200).json({ codes });
    });
  } catch (error) {
    if(!res.destroyed&&!res.writableEnded)res.status(aiFailureStatus(error)).json({error:error instanceof Error?error.message:'AI provider failed'});
  }
}
