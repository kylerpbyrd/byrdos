# ADR-0010: Deployment Pipeline and Migration Runbook

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07-20 |
| Author | Architect (byrdOS) |
| Supersedes | — |
| Superseded by | — |
| Inherits | ADR-0000 |
| Implements | §6 Security-first, §11 Observability-first |

## Context

byrdOS is a multi-service platform with a Next.js frontend, NestJS API, background workers, Postgres, and Redis. ADR-0000 §6 (security-first development) requires controlled, auditable deployments and explicit approval for destructive database changes. ADR-0000 §11 (observability-first engineering) requires logs, traces, metrics, and health checks from day one. This ADR defines the environment topology, deployment targets, CI pipeline, database migration runbook, and observability stack.

## Decision

### Environments

```
local → preview (per-PR) → staging (shared) → prod
```

### Deployment targets

| Component | Platform |
|---|---|
| apps/web (Next.js) | Vercel |
| apps/api (NestJS) | Fly.io or Render |
| services/sync-worker | Fly.io or Render |
| services/webhook-worker | Fly.io or Render |
| services/scheduler | Fly.io or Render |
| PostgreSQL | Neon or Supabase (managed) |
| Redis | Upstash |

### CI pipeline (GitHub Actions)

1. **On pull request**: install → lint → typecheck → affected tests → build → Spectral lint → preview deploy.
2. **On merge to main**: build images → push to GHCR → deploy to staging previews.
3. **On tag**: promote images to production → run migration job → rollout.
4. **Nightly**: security scans, end-to-end regression tests, dependency review.

### Migration runbook

- `drizzle-kit generate` creates SQL migrations from the TypeScript schema; generated migrations are committed and reviewed.
- `drizzle-kit migrate` is applied as a one-shot job in the deploy pipeline before the application rollout.
- Zero-downtime rule: no destructive migrations without an expand/contract pull request that is reviewed and approved separately.
- Migrations gate deploy: application rollout is blocked if pending migrations exist.
- Rollback: if a migration fails, deploy the previous application version. Schema changes must remain backward-compatible so rollback is safe.

### Observability

- **Logs**: pino structured JSON to stdout, collected by the platform log aggregator.
- **Traces**: OpenTelemetry via W3C `traceparent` propagation; exported to Honeycomb or Datadog.
- **Metrics**: Prometheus endpoints or OpenTelemetry metrics where the platform supports them.
- **Alerts**: SLO-based; page on error rate > 1% or sync latency > 2x baseline.
- **Health checks**:
  - `GET /health` — liveness probe.
  - `GET /health/ready` — readiness probe verifying Postgres and Redis connectivity.

## Consequences

- **Positive**: Managed platforms reduce operational toil and provide built-in TLS, scaling, and backups.
- **Positive**: Migration gating and expand/contract discipline keep production deployments reversible.
- **Negative**: Managed Postgres and Redis introduce vendor-specific operational runbooks and cost scaling considerations.
- **Negative**: Nightly security and e2e jobs consume CI minutes and require maintenance.

## Alternatives considered

- **Self-hosted Kubernetes cluster** — rejected: Adds operational overhead disproportionate to M0–M2 scale; can be revisited when multi-region or specialized compliance requirements arise.
- **Manual migrations** — rejected: Inconsistent with ADR-0000 §6; automated, reviewed, and gated migrations reduce human error.

## Changelog

| Date | Change | Author |
|---|---|---|
| 2026-07-20 | Accepted deployment pipeline, migration runbook, and observability stack | Architect (byrdOS) |
