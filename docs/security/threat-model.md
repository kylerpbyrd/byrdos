# byrdOS Threat Model — M6 Review

**Scope:** API (`apps/api`), authentication/authorization, secrets management, webhook handling, and third-party provider integrations at milestone M6.

**Assumptions:**

- Production secrets are injected via environment variables / KMS; no secrets are committed.
- All repository queries enforce `userId` tenant scoping (verified by service-layer tests).
- JWT session tokens are short-lived; refresh tokens are rotated with reuse detection.
- Plaid (and future provider) access tokens are stored as AES-256-GCM envelope-encrypted blobs with a `keyId` reference.

## Assets

| Asset | Sensitivity | Notes |
|-------|-------------|-------|
| User financial data (accounts, transactions, balances) | High | Core value of the platform; governed by financial privacy expectations. |
| Provider access tokens (Plaid) | Critical | Stored envelope-encrypted at rest; decryption key never in the DB. |
| JWT session / refresh tokens | High | Bearer credentials; refresh rotation limits replay window. |
| PII (email, names, phone, identifiers) | High | Subject to privacy regulations; must be redacted from logs. |
| Audit logs | High | Integrity relied on for incident response and compliance. |

## Threat Inventory

| # | Threat | Severity | Mitigation | Status |
|---|--------|----------|------------|--------|
| 1 | **IDOR across multi-tenant endpoints** — User A accesses User B’s integrations/accounts/transactions | Critical | Tenant-scoped repositories (`userId` filtering on every query) + ownership checks in service layer before acting on an ID. | ✅ Mitigated |
| 2 | **Token / secret exfiltration** — Access tokens or JWTs leaked via logs, responses, or DB dump | Critical | AES-256-GCM envelope encryption for stored tokens; pino redaction paths for `authorization`, `accessToken`, `token`, `secret`, `cipher`, etc.; fail-closed production lock on missing secrets. | ✅ Mitigated |
| 3 | **Rate-limit abuse / brute-force** — Credential stuffing, enumeration, or webhook floods | High | Global `ThrottlerGuard` (100 req/min default) with Redis-backed storage; health endpoints excluded from throttling. | ✅ Mitigated (this task) |
| 4 | **Webhook spoofing** — Fake provider callbacks trigger state changes | High | Provider signature verification on every webhook (Plaid signature + version headers); rejected if signature invalid. | ✅ Mitigated |
| 5 | **SSRF via provider callbacks** — Malicious URLs in OAuth/linking callbacks | Medium | Strict allow-list of provider callback URLs; no user-supplied URLs fetched server-side without validation. | ⚠️ Partially mitigated |
| 6 | **Credential loss / key compromise** — Encryption key leaked or lost | Critical | Key reference via `keyId`; production keys managed in KMS; key rotation support in envelope schema. | ✅ Mitigated |
| 7 | **CSRF / XSS** — Session hijacking or forced actions | Medium | JWT-in-header auth; `SameSite=Lax` cookies where cookies are used; Helmet security headers (CSP, HSTS, etc.). | ✅ Mitigated |
| 8 | **Insufficient audit coverage** — Sensitive operations occur without trace | Medium | Audit writes for token issuance, refresh, revocation, integration link, and integration revoke. | ✅ Mitigated |
| 9 | **Mass assignment / schema bypass** — Clients write fields they should not | Medium | Zod/contracts validation on all inputs; DTOs restrict writable fields. | ✅ Mitigated |
| 10 | **Dependency vulnerability** — Supply-chain compromise in auth or crypto packages | Medium | Lockfile, automated CVE scanning, minimal dependency surface. | ⚠️ Ongoing |

## Open Items / Residual Risk

1. **Distributed rate-limit precision.** The Redis-backed throttler uses simple INCR/EXPIRE with a separate block key; high-concurrency races could allow a small burst over the limit. Evaluate a Lua-based atomic increment/block if stricter enforcement is required.
2. **SSRF hardening.** Callback URL allow-lists are enforced, but a dedicated SSRF-safe HTTP client (no redirects, resolved-IP checks) is not yet in place.
3. **CSP tightening.** The current CSP allows `'unsafe-inline'` and `'unsafe-eval'` to support Swagger UI. Once Swagger is moved behind auth or a separate docs host, tighten script/style directives.
4. **Rate-limit per-user vs. per-IP.** Current tracker defaults to request IP. Authenticated endpoints should consider a composite key (`userId` or IP) to prevent IP-rotation bypass and to avoid punishing shared NAT users.
5. **Secret rotation drill.** KMS-backed key rotation has schema support but an end-to-end rotation runbook has not been executed.
6. **Penetration testing.** No third-party penetration test has been performed; plan for M7.

## Security-First Decisions (ADR-0000 §6)

- Secrets are never logged, committed, or returned in API responses.
- Rate limiting is fail-open on Redis unavailability so health checks and core flows remain available; monitoring must alert on Redis failures.
- All new sensitive fields introduced anywhere in the stack must be added to the pino redaction path list in `apps/api/src/main.ts`.
