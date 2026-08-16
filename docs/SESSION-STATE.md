# SESSION-STATE — handoff

> Updated: 2026-08-15 (M6 — OTEL span emission complete + runtime-verified)
> Last commit: work uncommitted (see `git status`); based on `266f7f2`

## Where we are

| Milestone | Status |
|---|---|
| M0–M4.5 | ✅ Complete |
| M4.6 — Connect→Sync→Display Repair | ✅ Complete + runtime-verified (live Plaid sandbox: 12 accounts / 48 transactions) |
| M4.7 — Solidify the slice | ✅ Complete (FlowProducer ordering fix, ProviderRegistry + FakeProviderAdapter, CI-safe fixture e2e) |
| M5 — Dashboard Frontend | ✅ Complete (live sync polling, re-link flow, fonts, RSC fix, verified in browser) |
| M6 — Observability / Hardening / Prod | 🚧 **In progress** — OTEL span emission done |

## M6 remaining (next session)

1. ✅ **Real OTEL span emission** — DONE. Real OTEL SDK (`@opentelemetry/*`) in `packages/observability`; spans `sync.orchestrate` / `sync.accounts` / `sync.transactions` / `sync.job` wired into the sync workers; W3C trace-context propagated across BullMQ job boundaries; `sync.job` emitted retroactively at terminal status (guarded idempotent). Runtime-verified live (success + failure paths). See ADR-0013.
2. **HTTP server auto-instrumentation** — `http.route` / `http.status_code` spans for the ADR-0012 API latency/error SLOs (deferred from the OTEL slice; add in `apps/api/src/main.ts`).
3. **k6 load test**.
4. **OWASP ZAP + gitleaks** automated scans (a manual grep-based secret scan came back clean).
5. **Dead-letter alerting** — scheduler only logs a warning; no real alerting yet.
6. **Production deployment**.

## Deferred (documented, low priority)

- `db.transaction()` wrapping for multi-table atomicity.
- Graphify **docs** semantic extraction — optional; needs `GEMINI_API_KEY` (the code graph is built locally via `--code-only`, no key required).

## Key facts / gotchas

- **Plaid = sandbox only.** `PlaidAdapter` has a fail-closed guard: refuses `PLAID_ENV=production` unless `PLAID_ALLOW_PRODUCTION=true`. Sandbox creds live in local `.env` (untracked); placeholders in `.env.example`.
- `.env` is untracked (local secrets). Never commit it.
- Docker: `docker compose up -d` (Postgres 17 + Redis 7). Migrations: `pnpm --filter @byrdos/db db:migrate`.
- Run stack: `pnpm dev` (API :4000, web :3000) plus the sync-worker. Services `start` runs compiled `dist` — rebuild after backend changes.
- Test user (connected, live sandbox): `m5-live2@byrdos.test` / `Passw0rd!123` (connection `019ffda0-6483-7ee3-8821-4fe9ad595086`).
- `drizzle-kit generate` reads compiled `dist/schema` (fixed the NodeNext `.js`-import bug); `db:generate`/`db:push` build first.
- Graphify works (v0.9.22 + `networkx`). `.graphifyignore` excludes `.agents/`. Rebuild: `python -m graphify extract . --code-only --force`. Query: `python -m graphify query "..."`.
- **OTEL tracing**: console span exporter by default (spans as JSON to stdout — visible in service logs); OTLP HTTP exporter enabled only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. Each service entrypoint calls `initTracing(serviceName)` and `shutdownTracing()` on SIGTERM. `@byrdos/observability` exports `getTracer().startSpan(...)`, `injectTraceContext(span?)`, `extractTraceContext(carrier?)`.
- OTEL SDK line: `@opentelemetry/sdk-trace-node@^2.10.0` with `@opentelemetry/api@^1.9.x` (v2 SDK, verified working at runtime).

## Next recommended starting point

1. `git status` + `git log --oneline -15`.
2. Resume M6 — **HTTP server auto-instrumentation**, then k6 load test / ZAP+gitleaks / DLQ alerting / prod deploy.
