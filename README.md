# AI Documentation Assistant

The repository documentation path now uses tenant-scoped connectors, permission-aware incremental indexing, durable isolated jobs, grounded schema-validated AI output, deterministic quality/safety/cost/latency gates, and explicit human approval.

```bash
npm ci
npm run db:deploy
npm run db:generate
./start.sh
```

Provide the variables documented in `.env.example` through the process environment or a secret manager before migration and startup. Run `npm run worker:governance` under a separate supervisor. Startup never installs dependencies or mutates persistent data. See [the governed workflow](docs/GOVERNED_DOCUMENTATION.md), [operations](docs/OPERATIONS.md), and [testing](docs/TESTING.md).
