/**
 * 3-strategy AI JSON parser shared across the app.
 * Returns { parsed, raw }.
 *  - Strategy 1: ```json ... ``` fenced code block
 *  - Strategy 2: first balanced { ... } object scan (string-aware)
 *  - Strategy 3: parse the entire string
 */
export interface ParseResult<T = any> {
  parsed: T | null;
  raw: string | null;
}

export function parseAIJson<T = any>(input: unknown): ParseResult<T> {
  if (input == null) return { parsed: null, raw: null };
  const raw = String(input);

  // Strategy 1: fenced code block
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try {
      return { parsed: JSON.parse(fenceMatch[1].trim()) as T, raw };
    } catch (_) {
      // continue
    }
  }

  // Strategy 2: balanced brace scan
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (esc) { esc = false; continue; }
    if (c === '\\' && inStr) { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        const candidate = raw.substring(start, i + 1);
        try {
          return { parsed: JSON.parse(candidate) as T, raw };
        } catch (_) {
          start = -1;
        }
      }
    }
  }

  // Strategy 3: full string
  try {
    return { parsed: JSON.parse(raw) as T, raw };
  } catch (_) {
    return { parsed: null, raw };
  }
}

export default parseAIJson;
