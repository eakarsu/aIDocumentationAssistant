import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';

const aiRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 20 });

interface SOAPDraft {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

async function generateSOAPDraft(
  chief_complaint: string,
  procedures_performed: string,
  patientHistory?: object[]
): Promise<SOAPDraft> {
  const historyContext = patientHistory && patientHistory.length > 0
    ? `\n\nPatient History (recent notes):\n${JSON.stringify(patientHistory, null, 2)}`
    : '';

  const messages = [
    {
      role: 'system',
      content: `You are a clinical documentation specialist. Generate a structured SOAP note draft based on the provided information.

Return ONLY valid JSON with this exact structure:
{
  "subjective": "Patient's chief complaint, history of present illness, symptoms reported by patient",
  "objective": "Physical exam findings, vital signs, procedures performed, objective measurements",
  "assessment": "Clinical assessment, diagnoses, differential diagnoses",
  "plan": "Treatment plan, medications, follow-up, referrals, patient education"
}

Be thorough and use appropriate clinical language. Base the note on the provided chief complaint and procedures.${historyContext}`,
    },
    {
      role: 'user',
      content: `Chief Complaint: ${chief_complaint}\n\nProcedures Performed: ${procedures_performed}\n\nPlease generate a complete SOAP note draft.`,
    },
  ];

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'AI Documentation Assistant',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenRouter API error:', error);
    throw new Error('AI service request failed');
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as SOAPDraft;
    } catch {
      // Fall through to error
    }
  }

  throw new Error('Failed to parse AI response as SOAP note');
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

  const { chief_complaint, procedures_performed, patient_id } = req.body;

  if (!chief_complaint || typeof chief_complaint !== 'string' || chief_complaint.trim().length === 0) {
    return res.status(400).json({ error: 'chief_complaint is required' });
  }

  if (!procedures_performed || typeof procedures_performed !== 'string' || procedures_performed.trim().length === 0) {
    return res.status(400).json({ error: 'procedures_performed is required' });
  }

  try {
    // Fetch patient history if patient_id provided
    let patientHistory: object[] | undefined;
    if (patient_id && typeof patient_id === 'string') {
      const recentNotes = await prisma.note.findMany({
        where: {
          patientId: patient_id,
          status: { in: ['SIGNED', 'COSIGNED', 'FINAL'] },
        },
        orderBy: { encounterDate: 'desc' },
        take: 3,
        select: {
          noteType: true,
          encounterDate: true,
          content: true,
          summary: true,
          aiCodes: true,
        },
      });
      if (recentNotes.length > 0) {
        patientHistory = recentNotes as object[];
      }
    }

    const soap = await generateSOAPDraft(
      chief_complaint.trim(),
      procedures_performed.trim(),
      patientHistory
    );

    res.status(200).json({
      ...soap,
      generated_at: new Date().toISOString(),
      patient_id: patient_id || null,
      used_history: !!patientHistory,
    });
  } catch (error) {
    console.error('AI SOAP draft error:', error);
    res.status(500).json({ error: 'Failed to generate SOAP note draft' });
  }
}
