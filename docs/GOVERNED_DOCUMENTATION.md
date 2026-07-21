# Governed documentation workflow

The production path is a durable two-stage workflow: a tenant member queues an incremental repository sync or typed documentation job, and a separately supervised worker claims it with a PostgreSQL lease. API requests never execute connector or model tools inline.

## Tenant and connector boundary

- Every repository, job, AI run, evaluation, and approval belongs to a tenant. The API requires `x-tenant-id` when a user belongs to multiple tenants and verifies membership; the global application role never bypasses the tenant boundary.
- Connector tokens and webhook secrets use authenticated AES-256-GCM encryption. Missing, placeholder, or legacy credentials fail closed. GitHub deliveries require a repository-specific URL, HMAC verification, and a unique delivery ID.
- Repository syncs are idempotent, bounded to configured paths, 1,000 files and 200 KiB per file by default, and tied to an immutable commit SHA. Each indexed source stores SHA-256, source URL, permission principals, last-seen sync, and freshness. Missing paths are soft-deleted so deleted content cannot be retrieved later.

## Typed grounded generation

`POST /api/governance/jobs` accepts only registered tool kinds and the `documentation-tool-request/v1` fields. Tenant and permission principals are derived server-side. The worker retrieves only readable, non-deleted files, redacts recognizable secrets, marks stale and prompt-injection-bearing sources, and sends a provenance envelope in which source text is explicitly untrusted data.

Provider output must be strict `documentation-tool/v1` JSON with bounded title, Markdown, summary, warnings, and source/digest/line citations. Unknown citations, digest mismatches, secret-like output, missing evidence, latency overruns, and cost overruns feed deterministic gates. Blocked output is not exposed; review output waits for an owner, administrator, or reviewer to attest that sources were reviewed and output is safe.

## Job operations and observability

Jobs enforce tenant-scoped idempotency and creation rate limits. Workers use `FOR UPDATE SKIP LOCKED`, bounded leases and timeouts, exponential retry, dead letters, cooperative cancellation, and trace IDs. Audit logs store digests and decisions instead of raw prompts. Provider receipts record model, request ID, usage, cost, and latency without credentials.

Run the worker separately from the web process:

```bash
npm run worker:governance
```

Monitor queue age, retry/dead-letter rate, connector freshness, gate block/review rate, approval age, provider latency, and cost. Alert thresholds must be chosen from staging traffic and business objectives rather than copied from demo data.
