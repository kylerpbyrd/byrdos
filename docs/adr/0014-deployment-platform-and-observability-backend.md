# ADR-0014: Deployment Platform and Observability Backend

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-15 |
| Author | Architect (byrdOS) |
| Supersedes | — |
| Superseded by | — |
| Inherits | ADR-0000 |
| Amends | ADR-0010 |
| Implements | §6 Security-first, §11 Observability-first |

## Context

ADR-0010 established the deployment pipeline, environment topology, migration runbook, and initial observability shape for byrdOS, but intentionally left several target-platform and backend choices open ("Fly.io or Render", "Neon or Supabase", "Honeycomb or Datadog"). Those choices are now finalized and recorded here. This ADR amends ADR-0010's **Deployment targets** and **Observability** sections without editing ADR-0010 itself, per ADR-0000 §9 (documentation standards).

The deployment artifacts today are platform-agnostic: a single `turbo prune` Dockerfile and `docker-compose.staging.yml` support local development and CI builds. Fly.io will use per-app `fly.toml` files plus the shared Dockerfile, wired in the deploy CI step. Neon provides connection branching for preview/staging/prod isolation and built-in connection pooling; Upstash provides managed TLS Redis. Both expose connection strings that are injected as runtime secrets, not baked into images.

## Decision

### D1 — Platforms

- `apps/api` and all `services/*` workers (`sync-worker`, `webhook-worker`, `scheduler`, `outbox-relay`) deploy to **Fly.io**.
- `apps/web` (Next.js) stays on **Vercel**, as decided in ADR-0010.
- Managed PostgreSQL is **Neon**.
- Managed Redis is **Upstash**.

### D2 — Trace/metrics backend

- Services emit **OpenTelemetry** traces and metrics via **OTLP**.
- A **self-hosted OpenTelemetry Collector** receives OTLP traces and metrics.
- Metrics are exported from the collector to **Prometheus**; dashboards are built in **Grafana**.
- **Honeycomb** and **Datadog** are deferred until there is a clear operational need.
- The **console exporter** remains for local development.

### D3 — Alerting

- Alerts route through the existing Slack webhook sink: the `ALERT_WEBHOOK_URL` environment variable and `sendAlert()` function in `packages/observability`.
- PagerDuty and email alerting are not implemented for now.

## Consequences

- **Positive**: Platform choices are fixed, removing option paralysis and unblocking deploy CI wiring.
- **Positive**: Fly.io's container-native model maps directly to the existing Dockerfile, minimizing image rework.
- **Positive**: Neon connection branching supports preview/staging/prod isolation, and its built-in connection pooling protects against worker connection spikes.
- **Positive**: Upstash TLS Redis satisfies ADR-0000 §6 requirements for encrypted data-in-transit without operating a Redis cluster.
- **Positive**: Self-hosted OTel Collector + Grafana avoids paid observability vendor costs until traffic justifies them.
- **Negative**: Self-hosting the OTel Collector adds operational burden — the collector must be run, scaled, and patched by the team. This is an accepted tradeoff to defer a paid SaaS observability vendor before it is justified.
- **Negative**: Fly.io, Neon, and Upstash each introduce vendor-specific operational runbooks and cost-scaling considerations.
- **Neutral**: Connection strings for Neon and Upstash are injected as runtime secrets, not baked into images, preserving image portability.
- **Neutral**: ADR-0010 remains immutable; this ADR amends it by superseding the open choices in its **Deployment targets** and **Observability** sections.

## Alternatives considered

- **Render for `apps/api` and workers** — rejected: Fly.io selected as the container-native platform for backend services.
- **Supabase for PostgreSQL** — rejected: Neon selected for its connection branching and pooling model aligned with preview/staging/prod isolation.
- **Honeycomb or Datadog for traces/metrics** — rejected/deferred: self-hosted OTel Collector + Prometheus + Grafana chosen to avoid vendor cost until operational need is clear; can be adopted later without code changes because services emit standard OTLP.
- **PagerDuty or email alerting** — rejected: Slack webhook alerting is sufficient for the current stage.

## Changelog

| Date | Change | Author |
|---|---|---|
| 2026-08-15 | Accepted platform and observability backend decisions | Architect (byrdOS) |
