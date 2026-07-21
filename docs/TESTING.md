# Testing strategy

`npm test` runs dependency-free governance tests for typed schemas, tenant and permission isolation, digest integrity, secret redaction, prompt injection, freshness, incremental sync/deletion propagation, citation validation, quality/safety/cost/latency gates, idempotency, rate limits, leases, retries, dead letters, cancellation, approval attestations, audit minimization, timeouts, and tenant-scoped evaluation cases.

CI additionally validates and generates Prisma, type-checks, builds Next.js, audits the launcher and migration for destructive behavior, and applies the additive migration twice to a PostgreSQL fixture containing existing user/repository/file/webhook rows. A production release should also run provider contract tests against a restricted test account, GitHub webhook replay/duplicate tests, browser approval journeys, tenant-escape tests, representative repository load tests, and backup/restore drills.
