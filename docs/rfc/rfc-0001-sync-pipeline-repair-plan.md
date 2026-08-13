# RFC-0001: Sync Pipeline Repair Plan

| Field | Value |
|---|---|
| Status | Accepted (promoted to ADR-0011) |
| Date | 2026-08-13 |
| Author | Documentation Agent (byrdOS) |
| Supersedes | — |
| Related ADRs | ADR-0000, ADR-0003 |
| Implements | ADR-0000 §6 Security-first, §7 Interface-first, §11 Observability-first |

## Summary

This RFC proposes a repair plan for the byrdOS financial-data sync pipeline and records six architectural decisions that address P0/P1 audit findings. The repairs add a real `sync`-queue consumer, fix the bank-link exchange contract and ownership model, enforce accounts-before-transactions ordering, defer unowned scaffolding, adopt a fixture-driven E2E strategy, exclude agent/tooling content from the product knowledge graph, and add a fail-closed Plaid production guard.

> This RFC has been promoted to the accepted ADR-0011; the binding decisions are recorded in `docs/adr/0011-sync-pipeline-repair.md`.

## Motivation

An Architect-led P0/P1 audit found that the sync pipeline queues jobs but has no active consumer, contains an IDOR/token-discard defect in bank-link exchange, runs accounts and transactions concurrently, and is missing critical database constraints. Unowned scaffolding queues (classify, notifications, outbox, DLQ) and committed Graphify skill artifacts add further risk and bloat. These issues block M5 and threaten correctness, cost, and security unless resolved as a coherent unit.

## Proposed Solution

### Background / audit findings

The following findings are already verified by the Architect:

- **P0 — orphaned `sync` queue:** `apps/api/src/sync/sync.controller.ts`, `services/scheduler`, and `services/webhook-worker` all enqueue `SyncJobData` to the `sync` queue, but there is no BullMQ Worker consumer. `SyncOrchestrator.startSync()` has no caller, so sync jobs queue and stop.
- **P0 — bank-link exchange defects:** The exchange endpoint stores the literal string `'placeholder-token'` and performs no ownership check (IDOR). `PlaidAdapter.exchangePublicToken` discards the real Plaid `access_token` instead of persisting it.
- **P0 — unsafe stage concurrency:** In the existing `FlowProducer` graph, accounts and transactions are sibling children and can run concurrently, which means transactions may be processed before accounts exist.
- **P1 — transaction cursor/upsert bugs:** The transactions worker writes an empty cursor and uses `onConflictDoNothing`, so updates and removals are never applied. The adapter ignores `modified` and `removed` arrays from the provider.
- **P1 — unowned scaffolding:** The event/outbox, classify, notifications, and DLQ queues are scaffolded but have no consumer.
- **P1 — missing constraints:** Multi-table writes are non-atomic and several UNIQUE constraints are missing:
  - `provider_connections(integration_id, external_id)`
  - `categories(user_id, norm_name)`
  - `sessions(refresh_hash)`
- **Bloat — Graphify scope:** Approximately 69% of Graphify nodes come from committed `.agents` skill content, and roughly 18 MB of `graphify-out/` is tracked in the repository.

### Decision 1: Sync consumer design

**Decision:** Convert `SyncOrchestrator` into a BullMQ Worker processor for the `sync` queue (`createSyncWorker`) and host it in a new `services/sync-worker` process. Existing producers (`sync.controller.ts`, `services/scheduler`, `services/webhook-worker`) keep enqueueing `SyncJobData`. The orchestrator creates the `SyncJob` row and uses BullMQ `FlowProducer` with **accounts as the parent** and **transactions as the child**, so transactions cannot start until accounts complete.

**Rationale:** This closes the P0 consumer gap without changing producer call sites, preserves the ADR-0003 FlowProducer model, and uses the parent/child relationship to guarantee the accounts-before-transactions ordering that sibling children could not provide.

### Decision 2: Contract changes (interface-first, ADR-0000 §7)

**Decision:** Update the provider adapter contract in `packages/contracts` before touching adapter implementations:

- Add `ExchangeResult { connection: ProviderConnection; accessToken: string }`.
- Change `IProviderAdapter.exchangePublicToken` to return `ExchangeResult`.
- Add a batch transactions result type: `TransactionBatch { added: ProviderTransaction[]; modified: ProviderTransaction[]; removed: string[]; nextCursor: string | null; hasMore: boolean }`.
- Keep `accessToken` off the `ProviderConnection` domain/DTO so it is never serialized to clients.

**Rationale:** Interface-first design lets the Backend Agent implement against a published contract, prevents the secret `access_token` from leaking into API responses, and gives the transactions worker enough information to apply updates and removals correctly.

### Decision 3: Scaffolding scope

**Decision:** Defer — do not remove — the classify, notifications, outbox, and DLQ queues until a concrete consumer exists. Each queue will be guarded behind a re-entry gate: an RFC or ADR that defines the consumer, event shape, retry policy, and SLO before code is added.

**Rationale:** Removing the queues now would erase useful infrastructure wiring and queue declarations. Deferring keeps the boundary explicit, avoids dead code in production, and prevents future agents from assuming the scaffolding is functional.

### Decision 4: E2E strategy

**Decision:** Adopt a fixture-driven fake provider as the default E2E provider. It is deterministic, offline, and runs in CI. Add an opt-in live-sandbox integration test gated behind an environment flag (for example, `PLAID_LIVE_SANDBOX_E2E=true`) that is skipped by default.

**Rationale:** The fake provider satisfies ADR-0000 §8 fixture-driven adapter testing, removes external-network flakiness from the critical path, and keeps CI fast. The opt-in sandbox test still validates real provider shape without risking production billing.

### Decision 5: Graphify scope

**Decision:** Exclude `.agents/**` and `graphify-out/**` from the product knowledge graph. Treat `graphify-out/` as a gitignored, reproducible build artifact and remove committed output from the repository.

**Rationale:** Agent skill files and generated graph output are tooling artifacts, not product architecture. Removing them restores Graphify's signal-to-noise ratio and keeps the canonical memory aligned with ADR-0000 §2.

### Decision 6: Plaid cost-safety

**Decision:** Add a fail-closed production lock to `PlaidAdapter`: if `environment === 'production'`, the adapter refuses to initialize or execute billable operations unless `PLAID_ALLOW_PRODUCTION=true` is explicitly set. The default development/CI environment remains sandbox.

**Rationale:** Plaid sandbox is always free; the Transactions product is billed per Item per month only in Production. The guard makes accidental production enrollment and billing impossible during development, testing, or agent-driven refactors.

### Cost-safety model

- **Sandbox** is always free per Plaid's billing documentation and is the default for development, review apps, and CI.
- **Production** is the only environment where Transactions is a subscription product charged per Item per month.
- The fail-closed guard in Decision 6 ensures that production access requires an explicit opt-in. No billable Plaid call can run in production by accident.

## Alternatives Considered

### Decision 1 — controller/scheduler calling `startSync()` directly

The controller and scheduler could call `SyncOrchestrator.startSync()` inline instead of adding a `sync-worker`. This was rejected because it would couple HTTP request handlers and cron jobs to long-running sync logic, defeat BullMQ retry/backoff semantics, and reintroduce the consumer gap if any caller is bypassed.

### Decision 3 — full removal of classify/notifications/outbox/DLQ scaffolding

Full removal was rejected because the queue declarations and wiring represent intentional future boundaries already captured in ADR-0003. Deleting them would force future agents to rediscover and redeclare those boundaries, increasing rework risk. Deferral with a re-entry gate preserves intent while preventing dead-code execution.

## Consequences

- **Milestone status:** M3 and M4 must be reclassified from Complete to Partial until the P0/P1 repairs land and verification passes.
- **M5 dependency:** M5 work is blocked until the sync consumer, contract changes, and database constraint migrations are merged.
- **Observability requirement (ADR-0000 §11):** Before this repair exits the milestone, per-stage OpenTelemetry spans must cover each sync stage (orchestrate → accounts → transactions), and a sync-success SLO must be defined and alertable.
- **Security improvement:** The IDOR and token-discard defects are closed; the production guard prevents accidental billable provider usage.
- **Testability improvement:** Fixture-driven E2E gives deterministic coverage of the full sync flow without external network dependencies.
- **Graphify hygiene:** Excluding tooling artifacts reduces node count and keeps architectural queries focused on product code.

## Impact Assessment

- **Packages affected:** `packages/contracts`, `packages/domain`, `packages/config`, `packages/observability`, `packages/tsconfig`, `packages/queue`, `packages/provider-sdk`, `packages/db`, `packages/auth`, `packages/ui`, `packages/test-utils`, `apps/api`, `services/scheduler`, `services/sync-worker` (new; hosts accounts and transactions workers), `services/webhook-worker`, Graphify tooling.
- **Agents affected:** Backend, API, Security, Testing, DevOps, Documentation.
- **Migration required:** Yes — create `services/sync-worker`, add database UNIQUE constraints/migrations, update `IProviderAdapter` implementations, migrate `.gitignore` and Graphify ignore rules, and remove committed `graphify-out/` content.
- **Breaking changes:** Yes — `IProviderAdapter.exchangePublicToken` and transaction fetch return types change. All adapter implementations and callers must update.
- **ADR changes required:** None. This RFC, once accepted, becomes a new ADR and does not supersede ADR-0003.

## Approval

- [ ] Architect review
- [ ] Backend Agent review
- [ ] Security Agent review
- [ ] User approval (required for Stage 3 promotion)
