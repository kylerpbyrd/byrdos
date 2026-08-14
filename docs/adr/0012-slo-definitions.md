# ADR-0012: SLO Definitions

Status: Accepted
Date: 2026-08-14
Author: Architect (byrdOS)
Inherits: ADR-0000
Implements: §11 Observability-first
Supersedes: —
Superseded by: —

## Context

ADR-0000 §11 (Observability-first engineering) requires alert targets and SLOs to be defined before a milestone exits the M-Stage. M6 is the production-hardening milestone for byrdOS, so concrete, measurable SLOs must be established for the sync pipeline, API availability, latency, error rate, and data freshness. This ADR records those SLOs and the OpenTelemetry spans that provide the primary measurement mechanism.

## Decision

byrdOS adopts the following SLOs. All measurements are derived from OpenTelemetry traces and metrics emitted through `packages/observability`, structured `pino` logs, and the `GET /health/ready` readiness probe. Alert thresholds are intentionally tighter than the SLO target to provide early warning before budget exhaustion.

### Sync completion

| Field | Value |
|---|---|
| **Metric** | Percentage of sync jobs that reach `completed` status within the target wall-clock time from enqueue. |
| **Target** | ≥99% of jobs complete within 5 minutes for initial syncs and 2 minutes for incremental syncs. |
| **Measurement source** | OTEL span `sync.job` from enqueue timestamp to terminal status, filtered by `sync.initial=true/false`; BullMQ job state logs. |
| **Failure definition** | Job status transitions to `failed` after all retries are exhausted. |
| **Alert threshold** | Page when 1-hour rolling completion rate drops below 97% or p95 duration exceeds target by 50%. |

### Sync success rate

| Field | Value |
|---|---|
| **Metric** | Percentage of sync jobs that terminate without a `failed` status. |
| **Target** | ≥99% of sync jobs succeed. |
| **Measurement source** | `SyncJob` row terminal status; OTEL span `sync.job` outcome attribute. |
| **Exclusion** | Provider-side `reauth_required` outcomes are counted separately as a distinct, non-failing status and do not count against the success-rate budget. |
| **Alert threshold** | Page when 1-hour rolling success rate drops below 98%. |

### API availability

| Field | Value |
|---|---|
| **Metric** | Percentage of time the API readiness probe returns HTTP 200 over a calendar month. |
| **Target** | 99.9% monthly availability. |
| **Measurement source** | Synthetic probe against `GET /health/ready` (verifies Postgres + Redis connectivity). |
| **Alert threshold** | Page on 3 consecutive probe failures; warn when 5-minute error rate exceeds 0.1%. |

### API latency

| Field | Value |
|---|---|
| **Metric** | p95 response latency for authenticated read endpoints. |
| **Target** | p95 < 500ms for `GET /accounts` and `GET /transactions`. |
| **Measurement source** | OTEL HTTP server span `http.route` attribute on `/accounts` and `/transactions`, bucketed by percentile. |
| **Alert threshold** | Warn when p95 exceeds 400ms for 5 minutes; page when p95 exceeds 750ms for 5 minutes. |

### Error rate

| Field | Value |
|---|---|
| **Metric** | Percentage of API requests that return an HTTP 5xx status. |
| **Target** | <1% of API requests return 5xx. |
| **Measurement source** | OTEL HTTP server span `http.status_code` attribute; `pino` access logs. |
| **Alert threshold** | Page when 5-minute 5xx rate exceeds 1%; warn at 0.5%. |

### Data freshness

| Field | Value |
|---|---|
| **Metric** | Percentage of active provider connections whose `SyncCursor` was updated within the last 24 hours. |
| **Target** | ≥99% of active connections have a sync cursor updated within 24h. |
| **Measurement source** | Database query against `provider_connections` joined to `sync_cursors`; emitted as a gauge metric `byrdos.sync.cursor.freshness`. |
| **Alert threshold** | Page when freshness drops below 97% for 10 minutes; warn at 98%. |

## Required OpenTelemetry spans

`packages/observability` must emit the following spans for every sync job so the sync SLOs can be measured accurately. Each span carries attributes including `syncJobId`, `providerConnectionId`, `integrationId`, `userId`, and `stage`.

| Span name | Stage | Parent | Key attributes |
|---|---|---|---|
| `sync.orchestrate` | Queue → orchestration start | root | `sync.initial`, `sync.trigger` (scheduled/webhook/manual) |
| `sync.accounts` | Fetch and persist accounts | `sync.orchestrate` | `account.count`, `provider.latency.ms` |
| `sync.transactions` | Fetch and persist transactions | `sync.accounts` | `transaction.added`, `transaction.modified`, `transaction.removed`, `nextCursor` |
| `sync.job` | End-to-end job envelope | none | `duration.ms`, `outcome` (`completed` / `failed` / `reauth_required`) |

These spans replace ad-hoc log-based duration calculations and are the authoritative source for sync completion, success-rate, and stage-level latency dashboards.

## Consequences

- **Positive**: SLOs provide a shared, quantitative definition of production readiness and a clear signal for paging.
- **Positive**: OTEL span requirements force a consistent measurement layer across sync workers, satisfying ADR-0011's observability requirement.
- **Negative**: Instrumentation must be kept in sync with the schema and worker code; missing span attributes will produce false SLO misses.
- **Future implication**: As the provider catalog grows, per-provider SLO variants may be added without changing the top-level definitions.

## Alternatives considered

- **Log-aggregation-only SLOs** — rejected: parsing logs for duration and outcome is brittle and slower than trace-native metrics.
- **Provider-native dashboards as source of truth** — rejected: Plaid dashboards do not cover byrdOS-internal stages (e.g., DB persistence, cursor update) and would fragment observability.
