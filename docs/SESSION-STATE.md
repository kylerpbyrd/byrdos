# SESSION-STATE — handoff

> Updated: 2026-08-14 (end of M6 session)
> Last commit: `fe09995`

## Where we are

| Milestone | Status |
|---|---|
| M0–M4.5 | ✅ Complete |
| M4.6 — Connect→Sync→Display Repair | ✅ Complete + runtime-verified (live Plaid sandbox: 12 accounts / 48 transactions) |
| M4.7 — Solidify the slice | ✅ Complete (FlowProducer ordering fix, ProviderRegistry + FakeProviderAdapter, CI-safe fixture e2e) |
| M5 — Dashboard Frontend | ✅ Complete (live sync polling, re-link flow, fonts, RSC fix, verified in browser) |
| M6 — Observability / Hardening / Prod | 🚧 **In progress** — foundation done |

## M6 remaining (next session)

1. **Real OTEL span emission** — `packages/observability` tracer is still `NoopTracer`; ADR-0012 defines the spans (`sync.orchestrate` → `accounts` → `transactions`) but nothing emits yet.
2. **k6 load test**.
3. **OWASP ZAP + gitleaks** automated scans (a manual grep-based secret scan came back clean).
4. **Dead-letter alerting** — scheduler only logs a warning; no real alerting yet.
5. **Production deployment**.

## Deferred (documented, low priority)

- `db.transaction()` wrapping for multi-table atomicity.
- Graphify graph rebuild — **blocked**: Graphify runtime lacks `networkx`; product graph should exclude `.agents/**` + `graphify-out/**` (both already gitignored for the product graph).

## Key facts / gotchas

- **Plaid = sandbox only.** `PlaidAdapter` has a fail-closed guard: refuses `PLAID_ENV=production` unless `PLAID_ALLOW_PRODUCTION=true`. Sandbox creds live in local `.env` (untracked); placeholders in `.env.example`.
- `.env` is untracked (local secrets). Never commit it.
- Docker: `docker compose up -d` (Postgres 17 + Redis 7). Migrations: `pnpm --filter @byrdos/db db:migrate`.
- Run stack: `pnpm dev` (API :4000, web :3000) plus the sync-worker. Services `start` runs compiled `dist` — rebuild after backend changes.
- Test user (connected): `m5-live2@byrdos.test` / `Passw0rd!123`.
- `drizzle-kit generate` reads compiled `dist/schema` (fixed the NodeNext `.js`-import bug); `db:generate`/`db:push` build first.
- Graphify runtime is broken (no `networkx`) — work from source + docs instead.

## Next recommended starting point

1. `git log --oneline -15` + read `docs/roadmap/milestones.md` status.
2. Resume M6 — start with **OTEL span emission** (replace the `NoopTracer` with a real tracer + wire spans into the sync workers), or go security-first (gitleaks/ZAP) if preferred.
