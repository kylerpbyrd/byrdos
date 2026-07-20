# ADR-0009: Idempotency and Retry Policy

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07-20 |
| Author | Architect (byrdOS) |
| Supersedes | — |
| Superseded by | — |
| Inherits | ADR-0000 |
| Implements | §3 Domain-driven design, §11 Observability-first |

## Context

byrdOS makes calls to external financial aggregators and runs asynchronous sync jobs that may be retried after partial failures. ADR-0000 §3 (domain-driven design) requires bounded contexts to behave correctly under retries and concurrent updates, and §11 (observability-first engineering) requires failures to be classified and observable. This ADR defines a shared error taxonomy, retry strategy, and idempotency rules.

## Decision

### Error taxonomy

| Class | Cause | HTTP | Retryable |
|---|---|---|---|
| ValidationError | Bad input | 400 | no |
| AuthError | Missing/expired session | 401 | no |
| ForbiddenError | Wrong tenant | 403 | no |
| NotFoundError | Resource absent | 404 | no |
| ProviderError | Upstream 5xx/rate-limit | 502 | yes (exp backoff) |
| ProviderAuthError | Re-link needed | 409 | no |
| ConflictError | Concurrent update | 409 | client decides |
| SyncPartialError | Some stages failed | 207 | partial |
| InternalError | Unhandled | 500 | yes |

### Retry strategy

- Provider HTTP calls: `[1s, 2s, 4s, 8s, 30s]` plus or minus 20% jitter, maximum 5 attempts.
- BullMQ jobs: `attempts: 5`, `backoff: { type: 'exponential', delay: 2000 }`.
- Final failures land on the `sync.dead` dead-letter queue for manual inspection and replay.

### Idempotency

- Idempotency key format: `<userId>:<operation>:<hash>`.
- Database-level uniqueness on `(externalId, accountId)` in the `Transaction` table prevents duplicate transactions across retries.
- All sync writes use an upsert pattern: insert if absent, update if present and the incoming data is newer.

## Consequences

- **Positive**: A shared taxonomy makes errors observable and actionable; alerts can target specific classes.
- **Positive**: Idempotency keys and upsert patterns make retries safe by default.
- **Negative**: `ConflictError` and `SyncPartialError` require callers to handle partial or ambiguous states explicitly.
- **Negative**: Dead-letter queue growth requires an operational runbook for replay or cleanup.

## Alternatives considered

- **Uniform retry for all errors** — rejected: Retrying validation or authorization errors wastes resources and can trigger rate limits.
- **Idempotency solely via DB unique constraints** — rejected: External provider operations (e.g., token exchange) need explicit idempotency keys to avoid duplicate side effects.

## Changelog

| Date | Change | Author |
|---|---|---|
| 2026-07-20 | Accepted error taxonomy, retry policy, and idempotency rules | Architect (byrdOS) |
