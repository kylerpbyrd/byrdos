# ADR-0007: Aggregator-First Integration with Plaid

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07-20 |
| Author | Architect (byrdOS) |
| Supersedes | — |
| Superseded by | — |
| Inherits | ADR-0000 |
| Implements | §5 Provider-agnostic, §6 Security-first |

## Context

byrdOS needs immediate, broad financial institution coverage while remaining architecturally open to additional aggregators and direct bank APIs. Plaid is the market leader in the United States, offers the most mature developer experience, and provides the webhooks, sandbox, and documentation required to validate the `IProviderAdapter` contract defined in ADR-0005. This ADR applies ADR-0000 §5 (provider-agnostic integrations) and §6 (security-first development) by choosing Plaid as the first concrete adapter and hardening its lifecycle.

## Decision

- The first aggregator integration is Plaid.
- `PlaidAdapter` implements `IProviderAdapter` from ADR-0005.
- All development and automated testing target the Plaid Sandbox environment.
- Inbound webhooks are verified using the `Plaid-Signature` header and the configured `plaid-version`.

### Plaid-specific lifecycle notes

- Link flow produces a `public_token`; the adapter exchanges it for an `access_token` and `item_id`.
- The `access_token` is encrypted at rest using AES-GCM (see ADR-0008); the encryption key is supplied via environment variable and never stored in the database.
- `item_id` is stored on `ProviderConnection.externalId` as the provider-neutral external identifier.
- Webhooks map to domain events:
  - `TRANSACTIONS` → incremental sync job
  - `ITEM_LOGIN_REQUIRED` → `RelinkRequired` domain event
- Rate limits are handled internally by the adapter; `PRODUCTS_NOT_READY` triggers exponential backoff before retry.

### Future providers roadmap

| Phase | Provider | Rationale |
|---|---|---|
| Phase 2 | MX | Broader FI coverage, especially credit unions and smaller banks |
| Phase 3 | Akoya | OAuth-native, bank-direct consent model |
| Phase 4 | Direct bank OFX/API | Varo-native fallback; pursued when scale or economics justify the integration cost |

## Consequences

- **Positive**: Plaid's sandbox and documentation let the team validate the full adapter contract before production traffic.
- **Positive**: Implementing Plaid first proves that ADR-0005's provider abstraction works in practice.
- **Negative**: Plaid's pricing and coverage gaps may require MX or Akoya sooner than planned.
- **Negative**: Webhook verification and token handling are Plaid-specific and must be thoroughly reviewed for security.

## Alternatives considered

- **MX first** — rejected: While MX has strong coverage, Plaid's developer experience and webhook maturity reduce integration risk for M0.
- **Direct bank APIs first** — rejected: Each direct integration is a multi-week commitment; an aggregator gives byrdOS broad coverage immediately.

## Changelog

| Date | Change | Author |
|---|---|---|
| 2026-07-20 | Accepted Plaid as first aggregator and provider roadmap | Architect (byrdOS) |
