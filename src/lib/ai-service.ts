import {z} from 'zod';
export class AiServiceError extends Error {constructor(message:string,public status:number){super(message);}}
// OpenRouter API for AI features
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export interface TranscriptionResult {
  text: string;
  speakers?: { speaker: string; text: string; timestamp: number }[];
  medicalTerms?: string[];
}

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  followUps: string[];
}

export interface MedicalCodeSuggestion {
  code: string;
  codeType: 'CPT' | 'ICD10';
  description: string;
  confidence: number;
}

export interface QualityCheckResult {
  score: number;
  issues: { field: string; message: string; severity: 'warning' | 'error' }[];
  suggestions: string[];
}

// Re-export 3-strategy parser from shared module for backward compatibility
import { parseAIJson as sharedParseAIJson } from './parseAIJson';

/**
 * Legacy helper: returns the JSON substring of a response, or null.
 * Internally relies on the shared 3-strategy parseAIJson.
 */
function extractJSON(content: string): string | null {
  // Strategy 1: fenced code block
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try {
      JSON.parse(fenceMatch[1].trim());
      return fenceMatch[1].trim();
    } catch (_) {}
  }

  // Strategy 2: balanced brace scan
  let braceCount = 0;
  let startIndex = -1;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') {
      if (braceCount === 0) startIndex = i;
      braceCount++;
    } else if (char === '}') {
      braceCount--;
      if (braceCount === 0 && startIndex !== -1) {
        const candidate = content.substring(startIndex, i + 1);
        try {
          JSON.parse(candidate);
          return candidate;
        } catch (_) {
          startIndex = -1;
        }
      }
    }
  }

  // Strategy 3: try whole string
  try {
    JSON.parse(content);
    return content;
  } catch (_) {
    return null;
  }
}

export const parseAIJson = sharedParseAIJson;

async function callOpenRouter(messages: { role: string; content: string }[], jsonResponse = true, signal?:AbortSignal): Promise<string> {
  signal?.throwIfAborted();
  if(!process.env.OPENROUTER_API_KEY)throw new AiServiceError('OpenRouter is not configured.',503);
  const controller=new AbortController(),cancel=()=>controller.abort(signal?.reason);
  signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
  const timeout=setTimeout(()=>controller.abort(new DOMException('AI provider timed out','TimeoutError')),45000);
  try{
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',signal:controller.signal,
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'AI Documentation Assistant',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    throw new AiServiceError(`OpenRouter could not complete this request (${response.status}).`,502);
  }

  const data = await response.json();
  controller.signal.throwIfAborted();
  const choice=data.choices?.[0];
  if(data.error||choice?.message?.refusal||['length','content_filter'].includes(choice?.finish_reason))throw new AiServiceError('OpenRouter refused or did not complete the response.',502);
  const content = data.choices?.[0]?.message?.content || '';

  if (jsonResponse) {
    // Try to extract valid JSON from the response
    const jsonStr = extractJSON(content);
    if (jsonStr) {
      // Validate it's actually parseable
      try {
        JSON.parse(jsonStr);
        return jsonStr;
      } catch {
        console.error('Extracted JSON is invalid:', jsonStr.substring(0, 200));
      }
    }

    // Fallback: try parsing the whole content
    try {
      JSON.parse(content);
      return content;
    } catch {
      console.error('Could not extract valid JSON from response');
    }
  }

  if(!content.trim())throw new AiServiceError('OpenRouter returned no answer.',502);
  return content;
  }catch(error){if(signal?.aborted)throw new AiServiceError('AI request cancelled.',499);if(error instanceof AiServiceError)throw error;throw new AiServiceError('The AI provider failed or returned invalid output.',502);}
  finally{clearTimeout(timeout);signal?.removeEventListener('abort',cancel);}
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string, signal?:AbortSignal): Promise<TranscriptionResult> {
  signal?.throwIfAborted();
  // Use OpenAI Whisper API for transcription
  if (!process.env.OPENAI_API_KEY) {
    throw new AiServiceError('Audio transcription requires a configured transcription provider.',503);
  }

  const controller=new AbortController(),cancel=()=>controller.abort(signal?.reason);signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();const timer=setTimeout(()=>controller.abort(),60000);
  try {
    // Determine file extension from mime type
    const extensionMap: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/mp3': 'mp3',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
      'video/webm': 'webm',
    };
    const extension = extensionMap[mimeType] || 'webm';

    // Create form data for Whisper API
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    formData.append('file', blob, `recording.${extension}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',signal:controller.signal,
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new AiServiceError('The transcription provider could not complete the request.',502);
    }

    const data = await response.json();
    controller.signal.throwIfAborted();const transcribedText = data.text;
    if(typeof transcribedText!=='string'||!transcribedText.trim())throw new AiServiceError('The transcription provider returned no transcript.',502);

    // Extract medical terms from the transcription
    const medicalTerms = await extractMedicalTerms(transcribedText,signal);

    return {
      text: transcribedText,
      medicalTerms,
    };
  } catch (error) {
    if(signal?.aborted)throw new AiServiceError('AI request cancelled.',499);if(error instanceof AiServiceError)throw error;throw new AiServiceError('The transcription provider failed.',502);
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}

export async function extractMedicalTerms(text: string,signal?:AbortSignal): Promise<string[]> {
  // Skip if no OpenRouter API key configured
  if (!OPENROUTER_API_KEY) {
    console.log('No OPENROUTER_API_KEY - skipping medical term extraction');
    return [];
  }

  try {
    const response = await callOpenRouter([
      {
        role: 'system',
        content: 'You are a medical terminology expert. Extract all medical terms, diagnoses, medications, and procedures from the text. Return ONLY a JSON object with format: {"terms": ["term1", "term2"]}',
      },
      {
        role: 'user',
        content: text,
      },
    ],true,signal);

    const result = JSON.parse(response);
    return result.terms || [];
  } catch (error) {
    if(signal?.aborted)throw new AiServiceError('AI request cancelled.',499);
    console.error('Medical term extraction failed');
    return [];
  }
}

export async function generateSummary(noteContent: object, signal?:AbortSignal): Promise<SummaryResult> {
  try {
    const response = await callOpenRouter([
      {
        role: 'system',
        content: `You are a medical documentation assistant. Summarize the clinical note and extract key points and follow-up items.
        Return ONLY a JSON object with format: { "summary": "brief summary", "keyPoints": ["point1", "point2"], "followUps": ["action1", "action2"] }`,
      },
      {
        role: 'user',
        content: JSON.stringify(noteContent),
      },
    ],true,signal);

    return z.object({summary:z.string().min(1).max(20000),keyPoints:z.array(z.string().max(3000)).max(50),followUps:z.array(z.string().max(3000)).max(50)}).parse(JSON.parse(response));
  } catch (error) {
    if(error instanceof AiServiceError)throw error;throw new AiServiceError('The provider returned an invalid summary.',502);
  }
}

export async function suggestMedicalCodes(noteContent: object, signal?:AbortSignal): Promise<MedicalCodeSuggestion[]> {
  try {
    const response = await callOpenRouter([
      {
        role: 'system',
        content: `You are a medical coding expert. Based on the clinical note, suggest appropriate CPT and ICD-10 codes.
        Return ONLY a JSON object with format: { "codes": [{ "code": "99213", "codeType": "CPT", "description": "description", "confidence": 0.95 }] }
        Include E/M codes (99201-99215), procedure codes if applicable, and relevant ICD-10 diagnosis codes.`,
      },
      {
        role: 'user',
        content: JSON.stringify(noteContent),
      },
    ],true,signal);

    const result = z.object({codes:z.array(z.object({code:z.string().min(1).max(100),codeType:z.enum(['CPT','ICD10']),description:z.string().min(1).max(3000),confidence:z.number().min(0).max(1)})).max(100)}).parse(JSON.parse(response));
    return result.codes;
  } catch (error) {
    if(error instanceof AiServiceError)throw error;throw new AiServiceError('The provider returned invalid unverified code suggestions.',502);
  }
}

export async function performQualityCheck(noteContent: object, noteType: string, signal?:AbortSignal): Promise<QualityCheckResult> {
  try {
    const response = await callOpenRouter([
      {
        role: 'system',
        content: `You are a medical documentation quality assurance expert. Review the ${noteType} note for completeness, accuracy, and compliance.
        Check for: missing required fields, incomplete documentation, ambiguous language, potential compliance issues.
        Return ONLY a JSON object with format: { "score": 85, "issues": [{ "field": "field name", "message": "issue description", "severity": "warning" }], "suggestions": ["improvement suggestion"] }
        Score should be 0-100.`,
      },
      {
        role: 'user',
        content: JSON.stringify(noteContent),
      },
    ],true,signal);

    return z.object({score:z.number().min(0).max(100),issues:z.array(z.object({field:z.string().max(300),message:z.string().max(3000),severity:z.enum(['warning','error'])})).max(100),suggestions:z.array(z.string().max(3000)).max(100)}).parse(JSON.parse(response));
  } catch (error) {
    if(error instanceof AiServiceError)throw error;throw new AiServiceError('The provider returned an invalid documentation review.',502);
  }
}

export async function structureNote(transcription: string, templateSections: object[],signal?:AbortSignal): Promise<object> {
  try {
    const response = await callOpenRouter([
      {
        role: 'system',
        content: `You are a medical documentation assistant. Structure the transcribed text into the provided template sections.
        Template sections: ${JSON.stringify(templateSections)}
        Return ONLY a JSON object with the section IDs as keys and the appropriate content extracted from the transcription.`,
      },
      {
        role: 'user',
        content: transcription,
      },
    ],true,signal);

    return JSON.parse(response);
  } catch (error) {
    if(error instanceof AiServiceError)throw error;throw new AiServiceError('The provider returned invalid structured note content.',502);
  }
}

export async function fillTemplate(
  partialContent: object,
  templateSections: object[],
  context?: string
): Promise<object> {
  try {
    const response = await callOpenRouter([
      {
        role: 'system',
        content: `You are a medical documentation assistant. Complete the missing sections of the clinical note based on the provided content and context.
        Template sections: ${JSON.stringify(templateSections)}
        Only fill in sections that are empty or incomplete. Maintain clinical accuracy.
        Return ONLY a JSON object with all section IDs as keys.`,
      },
      {
        role: 'user',
        content: `Existing content: ${JSON.stringify(partialContent)}${context ? `\nAdditional context: ${context}` : ''}`,
      },
    ]);

    return JSON.parse(response);
  } catch (error) {
    console.error('Template fill error:', error);
    throw new Error('Failed to fill template');
  }
}

export async function detectSpeakers(transcript: string): Promise<{ speaker: string; segments: { start: number; end: number; text: string }[] }[]> {
  // Use AI to identify and label speakers based on conversation context
  if (!OPENROUTER_API_KEY) {
    console.log('No OPENROUTER_API_KEY - returning default speaker structure');
    return [
      { speaker: 'Provider', segments: [] },
      { speaker: 'Patient', segments: [] },
    ];
  }

  try {
    const response = await callOpenRouter([
      {
        role: 'system',
        content: `You are a medical conversation analyst specializing in speaker diarization. Given a medical transcript, identify distinct speakers and attribute text segments to each speaker.

Use context clues to identify speakers:
- Clinical language, questions, examinations → likely "Provider" (or use specific title/name if mentioned: "Dr. Smith", "Nurse Jones")
- Patient descriptions, symptoms, personal info → likely "Patient"
- Third parties if present → "Family Member", "Interpreter", etc.

Split the transcript into segments attributed to each speaker. Return ONLY valid JSON with this structure:
{
  "speakers": [
    {
      "speaker": "Provider",
      "segments": [
        { "start": 0, "end": 1, "text": "exact text from transcript" }
      ]
    },
    {
      "speaker": "Patient",
      "segments": [
        { "start": 2, "end": 3, "text": "exact text from transcript" }
      ]
    }
  ]
}

The start/end values are sequential segment indices (0-based). Assign each portion of the transcript a unique sequential index.`,
      },
      {
        role: 'user',
        content: `Please identify and attribute speakers in this medical transcript:\n\n${transcript}`,
      },
    ]);

    const result = JSON.parse(response);
    return result.speakers || [
      { speaker: 'Provider', segments: [] },
      { speaker: 'Patient', segments: [] },
    ];
  } catch (error) {
    console.error('Speaker diarization error:', error);
    // Graceful fallback
    return [
      { speaker: 'Provider', segments: [] },
      { speaker: 'Patient', segments: [] },
    ];
  }
}
