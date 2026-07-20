# Errors, Retry, Caching, and Logging

byrdOS needs predictable failure handling: financial data syncs can fail because of provider rate limits, expired credentials, or transient network errors. This document defines the error taxonomy, retry strategy, idempotency keys, caching rules, and logging conventions.

These patterns are guided by ADR-0000 §6 (security-first development), §8 (testing requirements), and §11 (observability-first engineering). A future ADR will formalize this strategy as ADR-0009.

## Error taxonomy

| Error | Cause | Default retry | User-visible |
|---|---|---|---|
| `ProviderRateLimitError` | Provider rate limit | exponential backoff | no |
| `ProviderNotReadyError` | Product not ready yet | exponential backoff | no |
| `InvalidCredentialError` | Token revoked or invalid | no | yes (relink) |
| `RelinkRequiredError` | User must re-authenticate | no | yes (relink prompt) |
| `ProviderUnavailableError` | 5xx from provider | exponential backoff | no |
| `ValidationError` | Bad input from client | no | yes |
| `NotFoundError` | Resource missing | no | yes |
| `ConflictError` | Duplicate or race | no | yes |
| `UnauthorizedError` | Auth failed | no | yes |
| `InternalError` | Unhandled exception | no | generic message |

All provider-specific errors are normalized by the adapter into this taxonomy. No Plaid-specific error code leaks past `packages/provider-sdk`.

## Retry strategy

### Provider calls

- Exponential backoff: `[1s, 2s, 4s, 8s, 30s]`.
- ±20% jitter to avoid thundering herd.
- Max 5 attempts.
- `ProviderRateLimitError` uses `retryAfterMs` when provided by the adapter.
- `InvalidCredentialError` and `RelinkRequiredError` do not retry; they surface to the user.

### BullMQ configuration

```typescript
{
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: 100,
  removeOnFail: 1000,
}
```

### Dead-letter queue

After final failure, jobs move to `sync.dead`. A scheduled worker emits an alert for stuck jobs.

## Idempotency keys

Idempotency keys prevent duplicate work during retries and user retries.

### Format

```
<userId>:<operation>:<hash>
```

- `userId` scopes the key to a user.
- `operation` is a stable name like `sync-accounts` or `exchange-token`.
- `hash` is a deterministic hash of the operation-specific inputs.

### Storage

Idempotency keys are stored in Redis with a TTL matching the operation's expected duration. For provider calls, the key is included in the request metadata when the provider supports it.

### Database idempotency

- `Transaction` unique constraint: `(externalId, accountId)`.
- `Account` unique constraint: `(connectionId, externalId)`.
- `SyncJob` duplicate prevention via `(connectionId, type, trigger)` plus timestamp.

## Caching strategy

### Read-through Redis cache

- Account summaries, balances, and recent transactions are cached in Redis.
- Cache keys are prefixed by `userId` and resource type.
- TTLs are short to avoid stale financial data.

| Resource | TTL | Invalidation |
|---|---|---|---|
| Account list | 5 minutes | On sync completion |
| Current balance | 2 minutes | On balance update |
| Recent transactions | 5 minutes | On transactions fetched |
| Category rules | 10 minutes | On rule change |
| JWKS public keys | 1 hour | Manual rotation |

### Invalidation

- Sync workers emit events that invalidate relevant cache keys.
- Cache invalidation is performed by cache decorators or explicit invalidation handlers.
- No cache is used for write operations.

### Example cache key

```
byrdos:cache:accounts:{userId}:list
byrdos:cache:balances:{accountId}:current
byrdos:cache:transactions:{accountId}:recent
```

## Logging

byrdOS uses `pino` for structured JSON logging.

### Principles

- Structured JSON in production.
- Redaction of sensitive fields.
- Correlation via trace and span IDs.
- Log levels respected in all environments.

### Mandatory redaction paths

Per ADR-0000 §6, the following fields are never logged:

- `password`
- `token`
- `accessToken`
- `refreshToken`
- `cipher`
- `secret`
- `apiKey`
- `ssn`
- `raw` transaction payloads at `info` level

```typescript
export const logger = pino({
  redact: {
    paths: [
      'password',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.cipher',
      '*.secret',
      '*.apiKey',
      '*.ssn',
    ],
    remove: true,
  },
});
```

### Log levels

| Level | Usage |
|---|---|
| `debug` | Request/response bodies, cache hits, internal state |
| `info` | Sync start/end, user actions, job completion |
| `warn` | Retries, deprecated API usage, recoverable provider errors |
| `error` | Failed jobs, unhandled exceptions, security events |
| `fatal` | Data loss, inability to start, encryption failure |

### OpenTelemetry traces

Every service initializes an OTEL tracer. Cross-context calls and external provider calls are span boundaries.

```typescript
const span = tracer.startSpan('provider.fetchTransactions');
try {
  return await adapter.fetchTransactions(input);
} finally {
  span.end();
}
```

### Metrics

Key metrics emitted:

- `sync_jobs_total` by type and status
- `sync_job_duration_seconds` by stage
- `provider_requests_total` by provider and status
- `provider_rate_limited_total` by provider
- `cache_hit_ratio` by resource

## Consequences

- **Positive**: Normalized errors make retry and user messaging consistent.
- **Positive**: Idempotency prevents duplicate transactions and jobs.
- **Positive**: Structured logging simplifies alerting and debugging.
- **Negative**: Redaction paths must be maintained as new sensitive fields are added.
- **Negative**: Short cache TTLs increase database load but keep data fresh.
