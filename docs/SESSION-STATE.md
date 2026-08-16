# SESSION-STATE — handoff

> Updated: 2026-08-15 (M6 nearly complete — production deployment remains)
> Last commit: `4df728f`

## Where we are

| Milestone | Status |
|---|---|
| M0–M4.5 | ✅ Complete |
| M4.6 — Connect→Sync→Display Repair | ✅ Complete + runtime-verified |
| M4.7 — Solidify the slice | ✅ Complete |
| M5 — Dashboard Frontend | ✅ Complete |
| M6 — Observability / Hardening / Prod | 🚧 **In progress** — everything except prod deploy is done |

## M6 done this session

- **OTEL tracing** (ADR-0013): real `@opentelemetry/sdk-trace-node` v2 tracer; sync spans (`sync.orchestrate`/`sync.accounts`/`sync.transactions`/`sync.job`) with W3C trace-context across BullMQ; HTTP auto-instrumentation in `apps/api` (`http.route`/`http.response.status_code`). Runtime-verified live.
- **Metrics**: `prom-client` in `packages/observability`; `GET /metrics` (root path, `@Public`+`@SkipThrottle`) with gauges `byrdos_sync_cursor_freshness_ratio`, `byrdos_sync_success_ratio`, `byrdos_queue_depth{queue,state}` + `collectDefaultMetrics`.
- **Sync hardening**: terminal-failed jobs → `sync.dead` (exactly-once); `sendAlert()` webhook sink wired into the scheduler's DLQ check; removed the redundant 30-min balance fast-lane.
- **Security**: gitleaks CI + husky pre-commit; Plaid webhook **JWT** verification (jose) replacing the HMAC stub; CodeQL + `pnpm audit` in CI.
- **Secret leak remediation**: a real `.env` was in the PUBLIC repo history → rotated `AUTH_SECRET` + Plaid sandbox secret, scrubbed `.env` from history (`git filter-repo`) + force-pushed, added `SECURITY.md`.
- **Load/scan validation**: k6 smoke/load scripts (`tests/load/`) + OWASP ZAP baseline (`workflow_dispatch` CI + `docs/security-scanning.md` runbook).
- **Deploy prep**: platform-agnostic `Dockerfile` (turbo prune), `.dockerignore`, `docker-compose.staging.yml` (postgres/redis/migrate/api/workers), `docs/deployment.md`.

## M6 remaining

1. **Production deployment** — BLOCKED on platform decision (ADR-0010 left open): Fly.io vs Render (API+workers), Neon vs Supabase (Postgres), Upstash (Redis), and the trace/alert backends (Honeycomb/Datadog; Slack/PagerDuty). Once decided: wire deploy CI (staging on merge, promote on tag, one-shot `drizzle-kit migrate`), run k6 + ZAP against staging, deploy prod, one full prod sync, enable SLO alerting.

## Deferred / low priority

- `db.transaction()` wrapping for multi-table atomicity.
- Graphify docs semantic extraction (needs `GEMINI_API_KEY`; code graph is local).
- Balance-only fast-lane (removed; balances refresh on the 4h sync + webhooks + on-demand).

## Key facts / gotchas

- **Plaid = sandbox only.** `PlaidAdapter` fail-closed guard: refuses `PLAID_ENV=production` unless `PLAID_ALLOW_PRODUCTION=true`. Sandbox creds in local `.env` (untracked); placeholders in `.env.example`.
- `.env` is untracked (local secrets). **Never commit it.** gitleaks runs in pre-commit (husky) + CI.
- Docker: `docker compose up -d` (Postgres 17 + Redis 7). Migrations: `pnpm --filter @byrdos/db db:migrate`.
- Run stack: `pnpm dev` (API :4000, web :3000) + sync-worker/webhook-worker/scheduler. Services `start` run compiled `dist`.
- Test user (connected, live sandbox): `m5-live2@byrdos.test` / `Passw0rd!123`. Login endpoint: `POST /api/auth/signin` → `{ accessToken }`.
- `drizzle-kit generate` reads compiled `dist/schema`; `db:generate`/`db:push` build first.
- **OTEL**: console exporter locally; OTLP when `OTEL_EXPORTER_OTLP_ENDPOINT` set. `initTracing(serviceName, { instrumentHttp })` at entrypoints; `shutdownTracing()` on SIGTERM.
- **Metrics**: `/metrics` at root path. Metric names are underscore-separated (`byrdos_sync_cursor_freshness_ratio`), not ADR-0012's dot form.
- **Webhook**: Plaid `Plaid-Verification` header is now verified as a JWT via `jose` (key from `/webhook_verification_key/get`, cached). Webhook endpoint: `POST /api/webhooks/plaid` (needs a reachable host — not localhost).
- Graphify works (v0.9.22 + `networkx`). Rebuild: `python -m graphify extract . --code-only --force`. Query: `python -m graphify query "..."`.

## Next recommended starting point

1. `git log --oneline -15` + `git status`.
2. Decide the deployment platform (Fly/Render/Neon/Supabase), then wire deploy CI + staging, run k6/ZAP against staging, and do the prod deploy.
