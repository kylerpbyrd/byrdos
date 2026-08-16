# ADR-0013: OpenTelemetry Instrumentation Span Topology

Status: Accepted
Date: 2026-08-15
Author: Architect (byrdOS)
Inherits: ADR-0000 §11
Implements: —
Amends: ADR-0012 §Required OpenTelemetry spans
Supersedes: —
Superseded by: —

## Context

M6 is the production-hardening milestone for byrdOS. ADR-0012 defined concrete SLOs for the sync pipeline and required OpenTelemetry spans to measure them, but `packages/observability` currently ships a hand-rolled `NoopTracer` that returns `void`. That API cannot model span nesting, per-span attributes, span status, or cross-process trace propagation, so it cannot satisfy the SLO measurement requirements or the observability-first principle in ADR-0000 §11.

This ADR records the decision to adopt real OpenTelemetry instrumentation for the sync pipeline and amends the span topology in ADR-0012 §"Required OpenTelemetry spans". The topology amendment is necessary because `sync.accounts` and `sync.transactions` execute in separate BullMQ worker processes; the original table's "Parent" column implied `sync.transactions` is a direct child of `sync.accounts`, which is not physically realizable.

## Decision

### D1 — Real OTEL SDK

Replace the hand-rolled `NoopTracer` in `packages/observability` with the official OpenTelemetry Node SDK.

- Add dependencies: `@opentelemetry/api`, `@opentelemetry/sdk-trace-node`, `@opentelemetry/core`, `@opentelemetry/resources`, `@opentelemetry/semantic-conventions`, `@opentelemetry/exporter-trace-otlp-http`.
- Redesign the internal `Tracer` interface so that `startSpan` returns a `Span` handle.
- The old `void`-returning API is retired because it cannot represent nested spans, per-span attributes, or span status.

### D2 — Exporter strategy

Use a console-span exporter for local and development environments, emitting spans as JSON to stdout with zero external infrastructure. Switch to `OTLPHttpSpanExporter` only when the `OTEL_EXPORTER_OTLP_ENDPOINT` environment variable is set.

No collector endpoint is configured in this increment. The OTLP exporter is wired and prod-ready, but it remains unconfigured until a follow-on deployment slice.

### D3 — Span parenting across the process boundary

The sync pipeline spans three BullMQ worker processes (`sync-worker`, `accounts-worker`, `transactions-worker`). Because `sync.accounts` and `sync.transactions` run in separate processes, a live parent-child trace link from `sync.accounts` → `sync.transactions` is impossible.

Propagate W3C `traceparent`/`tracestate` through a `traceContext` field in BullMQ job data. Both `sync.accounts` and `sync.transactions` are therefore children of `sync.orchestrate`; the logical roll-up across the two stages is preserved via the shared `syncJobId` span attribute. This supersedes the parent relationship shown in ADR-0012's "Required OpenTelemetry spans" table, where `sync.transactions` was listed as a child of `sync.accounts`.

### D4 — `sync.job` envelope span emitted retroactively

The final outcome of a sync job is only known when the terminal status is written, which happens in the `transactions-worker`. Emit the `sync.job` span at that point with an explicit `startTime` equal to `syncJobs.startedAt` and `duration.ms` plus `outcome` attributes. This is a reconstructed envelope span, not a live span.

The `sync.job` envelope span carries a **reduced** attribute set: `syncJobId`, `stage='job'`, `outcome`, and `duration.ms` only. It is reconstructed retroactively at terminal-status write time from the `sync_jobs` row alone (`startedAt`/`finishedAt`). Populating `providerConnectionId`, `integrationId`, and `userId` on it would require a two-hop join (`sync_jobs` → `provider_connections` → `integrations`) per terminal status write; `syncJobId` is the correlation key to those attributes, so the join is unnecessary. This is a deliberate exception to the "every sync span carries shared attributes" statement, which otherwise applies to the three live spans (`sync.orchestrate`, `sync.accounts`, `sync.transactions`).

### Scope boundary

This increment covers manual sync-pipeline spans only. The following items are explicitly deferred to follow-on slices:

- HTTP server auto-instrumentation (`http.route`, `http.status_code`) required by ADR-0012 for API latency/error SLOs.
- k6 load testing.
- OWASP ZAP and gitleaks security scanning.
- Dead-letter alerting.
- Production deployment and collector configuration.

### Sync span catalog

`packages/observability` must emit the following spans for every sync job. Every sync span carries `syncJobId`, `providerConnectionId`, `integrationId`, `userId`, and `stage`.

| Span name | Stage | Parent | Key attributes |
|---|---|---|---|
| `sync.orchestrate` | Queue → orchestration start | root | `sync.initial`, `sync.trigger` (`scheduled` / `webhook` / `manual`) |
| `sync.accounts` | Fetch and persist accounts | `sync.orchestrate` | `account.count`, `provider.latency.ms` |
| `sync.transactions` | Fetch and persist transactions | `sync.orchestrate` | `transaction.added`, `transaction.modified`, `transaction.removed`, `nextCursor` |
| `sync.job` | End-to-end job envelope | none (reconstructed) | `duration.ms`, `outcome` (`completed` / `failed` / `reauth_required`) |

The `outcome` value `reauth_required` is a distinct, non-failing status and does not count against the success-rate SLO budget, consistent with ADR-0012.

## Consequences

- **Positive**: Real OTEL spans provide nested timing, per-span attributes, and status, enabling the SLOs defined in ADR-0012 to be measured accurately.
- **Positive**: W3C trace context propagation through BullMQ job data preserves a logical trace without requiring shared memory across worker processes.
- **Positive**: OTLP export is already wired; enabling production collection only requires setting `OTEL_EXPORTER_OTLP_ENDPOINT`.
- **Negative**: The SDK dependency footprint grows, and dependency upgrades must stay aligned across `@opentelemetry/*` packages.
- **Negative**: The `sync.job` envelope span is reconstructed from database timestamps; incorrect `startedAt` values would produce misleading duration measurements.
- **Future implication**: HTTP server auto-instrumentation will be added in a follow-on slice and will attach `http.route`/`http.status_code` to satisfy the API latency and error-rate SLOs.

## Alternatives considered

- **Keep the hand-rolled `NoopTracer` and derive SLOs from logs** — rejected: a `void`-returning tracer cannot model span nesting, per-span attributes, or status, making trace-native SLO measurement impossible.
- **Attempt a live parent span from `sync.accounts` to `sync.transactions`** — rejected: the jobs run in independent BullMQ worker processes with no shared tracer context, so a live parent-child link is physically impossible.
- **Emit `sync.job` from the orchestrator with an estimated end time** — rejected: the final outcome is only known when the transactions worker writes the terminal status; emitting earlier would produce incorrect or incomplete data.
