# ADR-0005: Provider Abstraction Pattern

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07-20 |
| Author | Architect (byrdOS) |
| Supersedes | — |
| Superseded by | — |
| Inherits | ADR-0000 |
| Implements | §5 Provider-agnostic, §7 Interface-first |

## Context

byrdOS will start with Plaid but must remain able to add MX, Akoya, and direct bank integrations without refactoring services, DTOs, or the domain model. ADR-0000 §5 mandates that provider-specific concepts stop at the adapter boundary, and §7 requires the cross-service interface to be published before implementation. This ADR defines the `IProviderAdapter` contract and the rules for keeping the service layer provider-agnostic.

## Decision

All aggregator and direct-bank integrations are hidden behind a single `IProviderAdapter` interface defined in `packages/contracts/domain`.

### The IProviderAdapter contract

```ts
interface IProviderAdapter {
  readonly providerId: ProviderId;

  initiateLink(userId: UserId, returnUri: string): Promise<LinkToken>;
  exchangePublicToken(payload: LinkCallback): Promise<ProviderConnection>;
  refreshCredentials(conn: ProviderConnection): Promise<ProviderConnection>;
  listAccounts(conn: ProviderConnection): Promise<ProviderAccount[]>;
  getBalances(conn: ProviderConnection, accountIds?: string[]): Promise<ProviderBalance[]>;
  listTransactions(
    conn: ProviderConnection,
    cursor: SyncCursor,
    range: DateRange,
  ): AsyncIterable<ProviderTransaction>;
  revoke(conn: ProviderConnection): Promise<void>;
  handleWebhook(event: RawWebhook): Promise<WebhookResult>;
}
```

### Design rules

- Every method returns provider-neutral DTOs defined in `packages/contracts`.
- Idempotency keys are passed through by the service layer but are opaque to the adapter.
- `ProviderRegistry` resolves `providerId -> IProviderAdapter` via a dependency-injection multi-provider.
- Plaid-specific concepts (`item_id`, `public_token`, `access_token`) live only inside `PlaidAdapter`; the service layer never sees them.
- Adding a second provider (MX, Akoya) requires only a new adapter file and registration in `ProviderModule.forRoot()`; no service or schema changes are permitted.

## Consequences

- **Positive**: True provider agnosticism enables multi-provider support without refactoring core services.
- **Positive**: The interface is owned by the API/Architecture agents and published before adapters are implemented, satisfying ADR-0000 §7.
- **Negative**: Adapter tests must be thorough to catch leaks of provider-specific types or concepts across the boundary.
- **Negative**: Some provider-specific features may be harder to expose uniformly; such gaps are accepted as a tradeoff for architectural cleanliness.

## Alternatives considered

- **Provider-specific service methods** — rejected: Would bake provider concepts into services and violate ADR-0000 §5.
- **Generic key/value payloads** — rejected: Loses type safety and makes agent comprehension harder.

## Changelog

| Date | Change | Author |
|---|---|---|
| 2026-07-20 | Accepted provider abstraction pattern and IProviderAdapter contract | Architect (byrdOS) |
