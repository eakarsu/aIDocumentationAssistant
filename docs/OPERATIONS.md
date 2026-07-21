# Operations

1. Copy `.env.example` to a secret-managed environment and replace every placeholder. Generate `JWT_SECRET` with at least 32 random bytes and `ENCRYPTION_KEY` with 32 random bytes encoded as 64 hex characters.
2. Install from the lockfile with `npm ci`, review the additive migration, back up PostgreSQL, and run `npm run db:deploy`. The migration assigns each existing user and repository to a personal legacy workspace without deleting application data.
3. Run `npm run db:generate`, build once, and supervise `npm run start` and `npm run worker:governance` as separate processes. The safe `start.sh` does not install, migrate, seed, reset, rewrite configuration, or kill unrelated processes.
4. Before production, rehearse backup/restore and rollback against a representative staging snapshot. Migration rollback is restore-based because dropping tenant/governance records would lose audit evidence.
5. Rotate connector credentials when migrating from the legacy CBC format; it is intentionally rejected. Rotate any secret that may have appeared in local files or Git history.

External launch gates remain: real provider quota/cost configuration, a licensed representative evaluation set, privacy and retention approval, webhook delivery testing, staging load/failure tests, backup/restore reconciliation, and security review of tenant roles and connector permissions.
