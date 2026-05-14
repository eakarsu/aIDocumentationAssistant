// OpenRouter API for AI features
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

async function callOpenRouter(messages: { role: string; content: string }[], jsonResponse = true): Promise<string> {
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
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
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenRouter API error:', error);
    throw new Error('AI service request failed');
  }

  const data = await response.json();
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

  return content;
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<TranscriptionResult> {
  // Use OpenAI Whisper API for transcription
  if (!OPENAI_API_KEY) {
    console.log('No OPENAI_API_KEY configured - returning placeholder');
    return {
      text: 'Transcription requires OPENAI_API_KEY in .env file. Add: OPENAI_API_KEY=your-key-here',
      medicalTerms: [],
    };
  }

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
    const blob = new Blob([audioBuffer], { type: mimeType });
    formData.append('file', blob, `recording.${extension}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Whisper API error:', error);
      throw new Error('Transcription failed');
    }

    const data = await response.json();
    const transcribedText = data.text || '';

    // Extract medical terms from the transcription
    const medicalTerms = await extractMedicalTerms(transcribedText);

    return {
      text: transcribedText,
      medicalTerms,
    };
  } catch (error) {
    console.error('Transcription error:', error);
    throw new Error('Failed to transcribe audio');
  }
}

export async function extractMedicalTerms(text: string): Promise<string[]> {
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
    ]);

    const result = JSON.parse(response);
    return result.terms || [];
  } catch (error) {
    console.error('Medical term extraction error:', error);
    return [];
  }
}

export async function generateSummary(noteContent: object): Promise<SummaryResult> {
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
    ]);

    return JSON.parse(response);
  } catch (error) {
    console.error('Summary generation error:', error);
    throw new Error('Failed to generate summary');
  }
}

export async function suggestMedicalCodes(noteContent: object): Promise<MedicalCodeSuggestion[]> {
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
    ]);

    const result = JSON.parse(response);
    return result.codes || [];
  } catch (error) {
    console.error('Medical coding error:', error);
    throw new Error('Failed to suggest medical codes');
  }
}

export async function performQualityCheck(noteContent: object, noteType: string): Promise<QualityCheckResult> {
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
    ]);

    return JSON.parse(response);
  } catch (error) {
    console.error('Quality check error:', error);
    throw new Error('Failed to perform quality check');
  }
}

export async function structureNote(transcription: string, templateSections: object[]): Promise<object> {
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
    ]);

    return JSON.parse(response);
  } catch (error) {
    console.error('Note structuring error:', error);
    throw new Error('Failed to structure note');
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
