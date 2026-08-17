# SESSION-STATE — handoff

> Updated: 2026-08-17 (strategic pivot + P1 design refresh in progress)
> Last commit: `5aa3ed0`

## The strategic pivot (read this first)

byrdOS is no longer "a bank-account-syncing app". It is becoming a **self-hosted application platform** — "an OS for multiple self-built apps to live side by side". See `docs/rfc/rfc-0002-platform-architecture-and-roadmap.md` (Status: Proposed — promote to ADR after owner approval).

**Decisions already locked with the owner:**
- **Design language**: Notion (warm paper canvas, near-black tight-tracked Inter, single blue `#0075de`, hairline + micro-shadows, pill CTAs). Canonical spec is `DESIGN.md`.
- **Finance app**: analytics-first — subscriptions, categorization, spend insights. Explicitly NOT envelope budgeting (not Actual Budget).
- **Architecture**: single Next.js shell + `apps/*` modules (e.g. `apps/finance`, `apps/fertility`), shared auth/design-system/infra.
- **Fertility app**: owner is building it; integrate later (privacy-first for health data).
- **External accounts** (Fly.io/Neon/Upstash per ADR-0014): **deferred to V1.0**. Local/sandbox until then.

## Where we are

| Milestone | Status |
|---|---|
| M0–M6 | ✅ Complete (bank-sync slice works end-to-end; observability, hardening, deploy wiring done) |
| P1 — Design refresh | 🚧 In progress (foundation done: Notion tokens + pill buttons) |
| P2 — Platform refactor | ⏳ Next |
| P3 — Finance analytics | ⏳ Later |
| P4 — Fertility app | ⏳ Later |
| P5 — Self-host polish | ⏳ Later |
| P6 — V1.0 (external accounts) | ⏳ Last |

## M6 was completed this session (already committed)

OTEL tracing (sync spans + HTTP), Prometheus `/metrics` + SLO gauges, dead-letter queue + `sendAlert` alerting, gitleaks CI + husky pre-commit, Plaid webhook JWT verification, k6 + ZAP (CI + runbook), platform-agnostic Dockerfiles + `docker-compose.staging.yml`, Fly/Neon/Upstash deploy CI (ADR-0014), and a public-repo secret-leak remediation (rotation + `git filter-repo` history scrub).

## P1 design refresh — what's done

- `apps/web/src/app/globals.css`: `@theme` remapped to Notion (canvas `#f6f5f4`, surface `#ffffff`, primary `#0075de`, secondary `#213183`, hairline `#e6e6e6`, radius scale 4/5/8/12/16px, layered micro-shadows, sticker `accent-*` palette). Light + dark blocks.
- `packages/ui/src/components/button.tsx`: primary CTA = `rounded-full` pill; utility/secondary = `rounded-md`.
- `packages/ui/src/components/input.tsx`: `rounded-xs` white surface.
- Card/separator/skeleton were already correct after the token remap (no code change needed).
- Fixed pre-existing `prefer-const` lint error in `packages/ui/src/sync-status.tsx`.

## P1 remaining (next session)

1. **Design polish pass** on whatever the owner flags visually (spacing/borders) — the browser is live, owner toggles light/dark and gives feedback.
2. **Fix the pre-existing `ThemeToggle` hydration mismatch** (renders Moon server-side / Sun client-side — classic `next-themes` SSR issue; fix with `suppressHydrationWarning` or a mount-gated icon).

## Key facts / gotchas

- **Plaid = sandbox only.** `PlaidAdapter` fail-closed guard refuses `PLAID_ENV=production` unless `PLAID_ALLOW_PRODUCTION=true`. Sandbox creds in local `.env` (untracked); placeholders in `.env.example`.
- `.env` is untracked — never commit. gitleaks runs in pre-commit (husky) + CI.
- Docker: `docker compose up -d` (Postgres 17 + Redis 7). Migrations: `pnpm --filter @byrdos/db db:migrate`.
- Run stack: `pnpm dev` (API :4000, web :3000) + sync-worker/webhook-worker/scheduler/outbox-relay. Services `start` run compiled `dist` — rebuild after backend changes.
- Test user (connected, live sandbox): `m5-live2@byrdos.test` / `Passw0rd!123`. Login: `POST /api/auth/signin` → `{ accessToken }`. Web session expires ~15 min.
- `drizzle-kit generate` reads compiled `dist/schema`; `db:generate`/`db:push` build first.
- **OTEL**: console exporter locally; OTLP when `OTEL_EXPORTER_OTLP_ENDPOINT` set. `initTracing(serviceName, { instrumentHttp })` at entrypoints; `shutdownTracing()` on SIGTERM.
- **Metrics**: `GET /metrics` at root path. Names are underscore-separated (`byrdos_sync_cursor_freshness_ratio`), not ADR-0012's dot form.
- **Webhook**: Plaid `Plaid-Verification` header verified as JWT via `jose` (key from `/webhook_verification_key/get`, cached). Endpoint `POST /api/webhooks/plaid`.
- **Categorization**: the `classify` BullMQ queue is stubbed — this is where P3 categorization lands.
- Graphify works (v0.9.22 + `networkx`). Rebuild: `python -m graphify extract . --code-only --force`. Query: `python -m graphify query "..."`.

## Next recommended starting point

1. `git log --oneline -15` + read `docs/rfc/rfc-0002-platform-architecture-and-roadmap.md` + `DESIGN.md`.
2. Confirm with owner: (a) finish P1 design polish on flagged issues, (b) fix ThemeToggle hydration, then (c) start P2 platform refactor.
3. Promote RFC-0002 → ADR (owner approval gate) before the P2 refactor.
