# ADR-0011: Sync Pipeline Repair

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-13 |
| Author | Architect (byrdOS) |
| Supersedes | — |
| Superseded by | — |
| Inherits | ADR-0000 |
| Implements | §2 Graphify-canonical, §5 Provider-agnostic, §6 Security-first, §7 Interface-first, §8 Testing, §11 Observability-first |

## 1. Context

A P0/P1 audit found that the byrdOS financial-data sync pipeline queues jobs but has no active consumer, exposes an IDOR/token-discard defect in bank-link exchange, runs accounts and transactions concurrently, and is missing critical database constraints. Unowned scaffolding queues and committed Graphify tooling artifacts add further risk and bloat. These issues block M5 and threaten correctness, cost, and security unless resolved as a coherent unit.

This ADR records the repair decisions approved via RFC-0001. It inherits ADR-0000 and applies its principles concretely to the sync pipeline; it does not supersede ADR-0003.

## 2. Decisions

### 2.1 Sync consumer design

**Decision:** Replace `SyncOrchestrator` with a BullMQ Worker processor for the `sync` queue (`createSyncWorker` in `services/sync-worker`). Existing producers (`apps/api/src/sync/sync.controller.ts`, `services/scheduler`, `services/webhook-worker`) keep enqueueing `SyncJobData`. The worker creates the `SyncJob` row and uses BullMQ `FlowProducer` with **accounts as the parent** and **transactions as the child**, so transactions cannot start until accounts complete.

**Rationale:** This closes the P0 consumer gap without changing producer call sites, preserves the ADR-0003 FlowProducer model, and uses the parent/child relationship to guarantee the accounts-before-transactions ordering that sibling children could not provide.

### 2.2 Contract changes (interface-first)

**Decision:** Update the provider adapter contract in `packages/contracts` before touching adapter implementations:

- Add `ExchangeResult { connection: ProviderConnection; accessToken: string }`.
- Add `TransactionBatch { added: ProviderTransaction[]; modified: ProviderTransaction[]; removed: string[]; nextCursor: string | null; hasMore: boolean }`.
- Change `IProviderAdapter.exchangePublicToken` to return `ExchangeResult`.
- Change `IProviderAdapter.listTransactions` to return `AsyncIterable<TransactionBatch>`.
- Keep `accessToken` off the `ProviderConnection` domain/DTO so it is never serialized to clients.

**Rationale:** Interface-first design lets implementation agents code against a published contract, prevents the secret `access_token` from leaking into API responses, and gives the transactions worker enough information to apply updates and removals correctly.

### 2.3 Scaffolding deferral

**Decision:** Defer — do not remove — the classify, notifications, outbox, and DLQ queues until a concrete consumer exists. Each queue will be guarded behind a re-entry gate: an RFC or ADR that defines the consumer, event shape, retry policy, and SLO before code is added.

**Rationale:** Removing the queues now would erase useful infrastructure wiring and queue declarations captured in ADR-0003. Deferring keeps the boundary explicit, avoids dead code in production, and prevents future agents from assuming the scaffolding is functional.

### 2.4 E2E strategy

**Decision:** Adopt a fixture-driven fake provider as the default E2E provider. It is deterministic, offline, and runs in CI. Add an opt-in live-sandbox integration test gated behind an environment flag (for example, `PLAID_LIVE_SANDBOX_E2E=true`) that is skipped by default.

**Rationale:** The fake provider satisfies ADR-0000 §8 fixture-driven adapter testing, removes external-network flakiness from the critical path, and keeps CI fast. The opt-in sandbox test still validates real provider shape without risking production billing.

### 2.5 Graphify scope

**Decision:** Exclude `.agents/**` and `graphify-out/**` from the product knowledge graph. Treat `graphify-out/` as a gitignored, reproducible build artifact and remove committed output from the repository.

**Rationale:** Agent skill files and generated graph output are tooling artifacts, not product architecture. Removing them restores Graphify's signal-to-noise ratio and keeps the canonical memory aligned with ADR-0000 §2.

### 2.6 Plaid cost-safety

**Decision:** Add a fail-closed production lock to `PlaidAdapter`: if `environment === 'production'`, the adapter refuses to initialize or execute billable operations unless `PLAID_ALLOW_PRODUCTION=true` is explicitly set. The default development/CI environment remains sandbox.

**Rationale:** Plaid sandbox is always free; the Transactions product is billed per Item per month only in Production. The guard makes accidental production enrollment and billing impossible during development, testing, or agent-driven refactors.

## 3. Consequences

- **Milestone status:** M3 and M4 must be reclassified from Complete to Partial until the P0/P1 repairs land and verification passes.
- **M5 dependency:** M5 work is blocked until the sync consumer, contract changes, and database constraint migrations are merged.
- **Observability requirement:** Before this repair exits the milestone, per-stage OpenTelemetry spans must cover each sync stage (orchestrate → accounts → transactions), and a sync-success SLO must be defined and alertable.
- **Security improvement:** The IDOR and token-discard defects are closed; the production guard prevents accidental billable provider usage.
- **Testability improvement:** Fixture-driven E2E gives deterministic coverage of the full sync flow without external network dependencies.
- **Graphify hygiene:** Excluding tooling artifacts reduces node count and keeps architectural queries focused on product code.
- **Deferred work:** The `db.transaction()` multi-table atomicity wrap is explicitly deferred as follow-up work. Only the UNIQUE constraints (`provider_connections(integration_id, external_id)`, `categories(user_id, norm_name)`, `sessions(refresh_hash)`) are in scope for the immediate repair.
