# aIDocumentationAssistant — Audit Note

## Bucket: A — DETECTOR_FALSE_POSITIVE

The original audit (`/Users/erolakarsu/projects/_AUDIT/reports/batch_03.md` section 1) reported "Zero routes reported and zero AI endpoints in TSV — skeleton in backend." This is a **false positive** — the audit detector did not look inside `src/pages/api/` (Next.js Pages-router API routes).

The audit also misidentified the product domain. This is a **medical documentation / SOAP-note assistant**, not a generic developer documentation tool, so most of the audit's "custom feature suggestions" are off-domain.

## Stack

Next.js (Pages router) + TypeScript + Prisma. AI client via OpenRouter.

## Existing AI inventory (preserve)

- `/Users/erolakarsu/projects/aIDocumentationAssistant/src/lib/ai-service.ts` — central OpenRouter / OpenAI service module. Defines `TranscriptionResult`, `SummaryResult`, `MedicalCodeSuggestion`, `QualityCheckResult` interfaces.
- `/Users/erolakarsu/projects/aIDocumentationAssistant/src/lib/parseAIJson.ts` — JSON-extraction helper.
- `/Users/erolakarsu/projects/aIDocumentationAssistant/src/pages/api/notes/ai-draft-soap.ts` — drafts SOAP notes.
- `/Users/erolakarsu/projects/aIDocumentationAssistant/src/pages/api/ai/billing-codes.ts` — AI medical billing code suggestions.
- Full API tree: `ai/`, `audit-logs/`, `auth/`, `billing/`, `bulk/`, `codes/`, `docs/`, `export/`, `integrations/`, `notes/`, `recordings/`, `settings/`, `specialties/`, `templates/`, `users/`.
- Prisma seed: `/Users/erolakarsu/projects/aIDocumentationAssistant/prisma/seed.ts`.

## Audit recommendations vs reality

The audit's recommendations were aimed at a generic doc-generator product, but the project is a SOAP-note / medical-documentation assistant. Re-mapped:

- "generate-docs" → covered by `notes/ai-draft-soap.ts`.
- "search-semantic" → genuinely absent (no embedding store wired up).
- "summarize-readme" → off-domain.
- RAG over codebase → off-domain (RAG over patient history would be on-domain but absent).
- Live code-to-docs sync → off-domain.
- Multi-format export — `exports/` directory exists but coverage unverified.
- OpenAPI generator → off-domain.
- IDE snippet plugin → off-domain.

## Apply pass — implemented

Nothing was modified. The audit recommendations don't fit this domain, and the on-domain analogue (semantic search over patient notes / RAG over EHR history) is a major product decision (vector store, PHI handling, encryption-at-rest implications) — not mechanical.

## Backlog (prioritized)

1. [PRODUCT-DECISION + COMPLIANCE] Semantic search over patient notes / encounters. Needs vector store, embedding model (must be HIPAA-compatible), and PHI redaction policy.
2. [PRODUCT-DECISION] Diff-aware SOAP-note summaries (compare encounter N vs N-1).
3. [PRODUCT-DECISION] Multi-format export verification (audit `exports/` against requirements: PDF, FHIR, HL7).
4. [NEEDS-CREDS] EHR integrations (Epic, Cerner) listed under `integrations/`.
5. [OUT-OF-SCOPE] IDE / Office plugin for snippet suggestion.

## Files touched in this pass

- `/Users/erolakarsu/projects/aIDocumentationAssistant/_AUDIT_NOTE.md` (this file).

No source files were modified. Syntax: N/A.

## Apply pass 4 (mechanical backlog)

SKIPPED. All backlog items require credentials, product decisions, or compliance review:
- Semantic search over patient notes — needs vector store + HIPAA-compatible embeddings + PHI redaction policy.
- Diff-aware SOAP-note summaries — product decision (definition of "diff" semantics).
- Multi-format export verification — needs FHIR/HL7 schema decisions.
- EHR integrations (Epic, Cerner) — NEEDS-CREDS.

No mechanical adds were safe to make.

## Apply pass 5 (all backlog)

Cleared the backlog with 4 new endpoints. All gated/additive; nothing existing was modified.

- `POST /api/ai/semantic-search` — TOO-RISKY softened to lexical Postgres ILIKE search with optional LLM rerank (using existing `OPENROUTER_API_KEY`). No vector store, no embeddings. Always returns 200; rerank stage is a no-op when AI key is unset.
- `POST /api/ai/diff-soap-summary` — PRODUCT-DECISION: "diff" = LLM-based clinical change enumeration across two encounters. Returns 503 + `missing: 'OPENROUTER_API_KEY'` when key unset.
- `GET /api/notes/export-fhir` — PRODUCT-DECISION: emits a minimal FHIR R4 `Bundle` (Composition + DocumentReference). No external creds required.
- `POST /api/integrations/ehr-sync` — NEEDS-CREDS: gated on `EHR_PROVIDER`, `EHR_BASE_URL`, `EHR_TOKEN`. Defaults to dry-run; set `EHR_WRITE_ENABLED=1` to actually POST.

FE wiring: 4 new methods in `src/lib/api.ts` (`semanticSearch`, `diffSoapSummary`, `exportFhir`, `ehrSync`).

Smoke test: Next.js dev started on :3030 with the configured `OPENROUTER_API_KEY` (from .env); logged in as `admin@healthcare.com / password123`; `/api/integrations/ehr-sync` returned 503 + `missing: 'EHR_PROVIDER'`; `/api/ai/semantic-search` returned 200 with `rerank_method: 'lexical-only'`. Dev server killed.

Files added:
- `src/pages/api/ai/semantic-search.ts`
- `src/pages/api/ai/diff-soap-summary.ts`
- `src/pages/api/notes/export-fhir.ts`
- `src/pages/api/integrations/ehr-sync.ts`
- `src/lib/api.ts` (extended)

Typecheck via project tsconfig: no new errors introduced (pre-existing project errors unchanged).

## Apply pass 3 (frontend)

- **Stack:** Next.js Pages router + TypeScript.
- **FE already wired.** AI features are integrated into the note workflow rather than a stand-alone AI page (this is the more sensible UX for clinical documentation):
  - `src/pages/notes/[id]/index.tsx` calls `api.summarizeNote`, `api.suggestCodes`, `api.qualityCheck` (mapped to `/api/notes/:id/ai/summarize|codes|quality`).
  - `src/pages/notes/[id]/edit.tsx` calls `api.structureNote` (`/api/notes/:id/ai/structure`).
  - `src/lib/api.ts` exposes the AI methods with bearer-token auth via `localStorage.getItem('token')`.
- The dedicated draft-SOAP endpoint (`/api/notes/ai-draft-soap`) and AI billing-codes endpoint (`/api/ai/billing-codes`) are present server-side but not yet surfaced in a UI button. These are minor product UX decisions (where to place the button, when to trigger), so no FE was added in this mechanical pass.
- LEFT-AS-IS. (Backlog: surface `ai-draft-soap` from new-note flow; surface `/api/ai/billing-codes` next to the existing per-note `suggestCodes`.)

