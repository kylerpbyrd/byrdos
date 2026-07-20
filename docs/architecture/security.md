# Security Architecture

Security is a first-class concern for byrdOS. The system handles financial credentials, transaction data, and PII, so controls are built in from the start rather than added later.

This document inherits ADR-0000 §6 (security-first development) and is supported by ADR-0004 (authentication) and ADR-0002 (database encryption and RLS).

## Security controls

| Control | Implementation | Verification |
|---|---|---|
| Token storage | AES-256-GCM envelope encryption; key not in DB | Encryption tests, audit |
| Transport | TLS 1.3 for all external traffic; HSTS in production | Certificate checks |
| Secrets | Managed in environment variables / secret manager | No secrets in repo |
| Session | Auth.js + rotating refresh tokens; JWKS verification | Reuse detection tests |
| CSRF | Auth.js CSRF tokens; OAuth state param; SameSite=Lax | Security tests |
| Webhook auth | Provider signature verification per adapter | Adapter tests |
| Rate limiting | BullMQ limiter + provider-aware throttling | Load tests |
| PII | Redaction in logs; minimal collection | Pino redaction tests |
| Multi-tenancy | RLS by userId; explicit userId in repository calls | RLS isolation tests |
| Supply chain | pnpm lockfile; dependency review; no secrets in npm scripts | CI audit |
| OWASP | Input validation, output encoding, parameterized queries | Security review gates |
| Compliance readiness | Audit logs, immutable financial records, encryption | Milestone gates |

## Encryption envelope

Credentials and tokens are stored as AES-256-GCM encrypted blobs.

```
plaintext
  ↓ AES-256-GCM encrypt
  → cipher + iv + authTag
  → stored in Credential.cipher, Credential.iv, Credential.authTag
  → keyId references the key in a secret manager
```

Rules:

- The encryption key is never in the database.
- The active key is referenced by `keyId`.
- Key rotation is supported by re-encrypting credentials with a new key during a maintenance window.
- Decryption happens inside the adapter when a credential is needed.

## Token handling

- Access tokens are JWTs with a 15-minute expiry.
- Refresh tokens are opaque, hashed, and rotated on use.
- Aggregator tokens (e.g., Plaid `access_token`) are encrypted at rest.
- Token values are never logged or returned in API responses.

## Session security

- Session cookies are `httpOnly`, `Secure`, and `SameSite=Lax`.
- Refresh-token reuse detection revokes the entire session family.
- Backend services verify JWTs via JWKS, not shared session state.

## CSRF protection

- Auth.js generates CSRF tokens for state-changing requests.
- OAuth flows include a `state` parameter validated on callback.
- Cross-origin requests from the web app to the API require an explicit CORS allowlist.

## Webhook authentication

Each adapter verifies provider signatures before any domain logic runs.

```typescript
async verifyWebhookSignature(input: WebhookVerificationInput): Promise<boolean> {
  const signature = input.headers['plaid-verification'];
  if (Array.isArray(signature)) return false;
  return verifyPlaidSignature(signature, input.body, input.secret);
}
```

Unverified webhooks are rejected with `401 Unauthorized`.

## Rate limiting

Rate limiting is applied at multiple layers:

- **API layer**: NestJS throttler per IP and user.
- **Queue layer**: BullMQ limiter per provider queue.
- **Provider layer**: Adapter-aware backoff on `ProviderRateLimitError`.

## PII handling

- PII is collected only when necessary.
- Logs redact sensitive fields using pino redaction paths.
- Raw provider payloads are retained for 90 days for dispute resolution, then purged by a scheduled job.
- User deletion is modeled explicitly; anonymization is preferred over hard deletion for financial records.

## Multi-tenancy

- Every user-facing table includes `userId`.
- PostgreSQL RLS policies enforce that a row can only be accessed by its owner.
- Application code passes `userId` from the JWT `sub` claim to repositories as a defense-in-depth measure.

```sql
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY accounts_user_isolation ON accounts
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::uuid);
```

## Supply chain security

- `pnpm-lock.yaml` is committed and validated in CI.
- New dependencies require review.
- No secrets are embedded in npm scripts or source code.
- CI scans for known vulnerabilities with `pnpm audit`.

## OWASP coverage

| Risk | Control |
|---|---|
| Injection | Drizzle query builder; parameterized queries |
| Broken auth | JWT + JWKS, rotating refresh tokens |
| Sensitive data exposure | Encryption at rest, TLS in transit, redaction in logs |
| XXE | No XML parsing of external provider data; JSON only |
| Broken access control | JWT guard, RLS, userId enforcement |
| Security misconfiguration | Shared config package, environment-specific configs |
| XSS | Output encoding in Next.js; no raw HTML from user input |
| Insecure deserialization | Zod validation for all request bodies |
| Known vulnerabilities | pnpm audit, dependency review |
| Logging failures | Structured logging, fail-closed redaction |

## Compliance readiness

byrdOS is designed with auditability and immutability in mind:

- `AuditLog` records sensitive operations.
- `EventLog` provides an outbox trail.
- Financial records are immutable or append-only.
- Encryption and access controls are in place for future compliance requirements.

## Milestone gates

Per ADR-0000 §6, the Architect and Security agent review the threat model at every milestone gate before the milestone exits the M-Stage.

## Consequences

- **Positive**: Security is built in, not bolted on.
- **Positive**: RLS and userId enforcement provide defense in depth.
- **Negative**: Encryption and RLS add latency and complexity.
- **Negative**: PII retention policies require careful implementation.
