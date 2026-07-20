# Provider Abstraction

byrdOS is designed to support many financial providers over time: banks, investment platforms, payroll APIs, and budgeting tools. The `IProviderAdapter` boundary ensures that no provider-specific concept leaks into services, DTOs, or domain models.

This design implements ADR-0000 §5 (provider-agnostic integrations). The first concrete adapter is Plaid; future adapters follow the same contract.

## The IProviderAdapter contract

`packages/provider-sdk/src/adapter.interface.ts` defines the common interface that every adapter must implement.

```typescript
export interface IProviderAdapter {
  readonly providerId: string;

  initiateLink(input: InitiateLinkInput): Promise<LinkToken>;
  exchangePublicToken(input: ExchangePublicTokenInput): Promise<ProviderConnectionResult>;
  refreshCredentials(input: RefreshCredentialsInput): Promise<CredentialResult>;

  fetchAccounts(input: FetchAccountsInput): Promise<FetchAccountsResult>;
  fetchBalances(input: FetchBalancesInput): Promise<FetchBalancesResult>;
  fetchTransactions(input: FetchTransactionsInput): Promise<FetchTransactionsResult>;

  verifyWebhookSignature(input: WebhookVerificationInput): Promise<boolean>;
  parseWebhookPayload(input: WebhookPayloadInput): Promise<ProviderWebhookEvent>;

  healthCheck(): Promise<ProviderHealthStatus>;
}
```

### Provider-neutral DTOs

All inputs and outputs are provider-neutral value objects defined in `packages/contracts`.

```typescript
export interface InitiateLinkInput {
  userId: string;
  returnUri: string;
  products: Product[];
}

export interface LinkToken {
  token: string;
  expiresAt: Date;
}

export interface ProviderConnectionResult {
  connection: ProviderConnection;
  credential: Credential;
  accounts: Account[];
}

export interface FetchTransactionsInput {
  connection: ProviderConnection;
  cursor?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface FetchTransactionsResult {
  transactions: Transaction[];
  nextCursor?: string;
  hasMore: boolean;
}
```

No Plaid field names such as `access_token`, `item_id`, `public_token`, or `accounts.product` appear in these DTOs. The adapter translates between provider payloads and neutral DTOs.

## ProviderRegistry DI multi-provider pattern

The registry maps a `providerId` to an adapter implementation. `apps/api` registers all adapters; domain and service code depend only on `IProviderAdapter`.

```typescript
// packages/provider-sdk/src/provider-registry.ts
export const PROVIDER_ADAPTER = Symbol('IProviderAdapter');

export interface IProviderRegistry {
  resolve(providerId: string): IProviderAdapter;
}

@Injectable()
export class ProviderRegistry implements IProviderRegistry {
  constructor(
    @Inject(PLAID_ADAPTER) private readonly plaid: IProviderAdapter,
    // @Inject(MX_ADAPTER) private readonly mx: IProviderAdapter,
  ) {}

  resolve(providerId: string): IProviderAdapter {
    switch (providerId) {
      case 'plaid':
        return this.plaid;
      default:
        throw new ProviderNotFoundError(providerId);
    }
  }
}
```

### Wiring in apps/api

```typescript
@Module({
  providers: [
    PlaidAdapter,
    {
      provide: PLAID_ADAPTER,
      useExisting: PlaidAdapter,
    },
    {
      provide: PROVIDER_REGISTRY,
      useClass: ProviderRegistry,
    },
  ],
})
export class ProviderLinkModule {}
```

Services receive `IProviderRegistry` and resolve the adapter at runtime:

```typescript
@Injectable()
export class LinkService {
  constructor(private readonly registry: IProviderRegistry) {}

  async initiate(userId: string, providerId: string) {
    const adapter = this.registry.resolve(providerId);
    return adapter.initiateLink({ userId, returnUri: '/', products: ['transactions', 'balance'] });
  }
}
```

## Plaid adapter as first implementation

`packages/provider-sdk/src/plaid/plaid.adapter.ts` is the first concrete adapter.

### Responsibilities

- Translate `InitiateLinkInput` → `link/token/create` and back to `LinkToken`.
- Translate `public_token` → `item/public_token/exchange` → `ProviderConnectionResult`.
- Map Plaid account objects to `Account` and `Balance` domain entities.
- Map Plaid transaction objects to `Transaction` domain entities.
- Verify Plaid webhooks via `PLAID-VERIFICATION` header.
- Convert Plaid rate-limit and error codes into provider-neutral errors.

### Internal structure

```
packages/provider-sdk/src/plaid/
├─ plaid.adapter.ts          # Implements IProviderAdapter
├─ plaid.client.ts           # Axios/fetch client with interceptors
├─ plaid.mapper.ts           # Plaid payload ↔ domain DTO mappers
├─ plaid.errors.ts           # Error code normalization
└─ plaid.webhook.ts          # Signature verification
```

### Error normalization

Plaid-specific errors are mapped to provider-neutral error types defined in `packages/provider-sdk/src/errors/`.

| Plaid error | Neutral error | Handling |
|---|---|---|
| `ITEM_LOGIN_REQUIRED` | `RelinkRequiredError` | Emit `RelinkRequired` event |
| `PRODUCTS_NOT_READY` | `ProviderNotReadyError` | Backoff and retry |
| `RATE_LIMIT_EXCEEDED` | `ProviderRateLimitError` | Exponential backoff |
| `INVALID_ACCESS_TOKEN` | `InvalidCredentialError` | Mark credential expired |

## Webhook verification

Each provider signs webhooks. The adapter encapsulates signature verification so that `services/webhook-worker` does not need provider-specific verification logic.

```typescript
export interface WebhookVerificationInput {
  headers: Record<string, string | string[]>;
  body: string;
  secret: string;
}

async verifyWebhookSignature(input: WebhookVerificationInput): Promise<boolean> {
  const signature = input.headers['plaid-verification'];
  if (Array.isArray(signature)) return false;
  return verifyPlaidSignature(signature, input.body, input.secret);
}
```

Unverified webhooks are rejected with `401 Unauthorized` before any domain logic runs.

## Rate limiting

Rate limiting is provider-aware. The adapter exposes a `rateLimit` hint that BullMQ uses to throttle jobs.

```typescript
export interface ProviderRateLimit {
  max: number;
  durationMs: number;
}
```

BullMQ `limiter` is configured per queue:

```typescript
new Worker('transactions', processor, {
  connection: redis,
  limiter: {
    max: 100,
    duration: 60000,
  },
});
```

When a provider returns a rate-limit response, the adapter throws `ProviderRateLimitError` with a `retryAfterMs` hint. The worker applies exponential backoff with jitter.

## How to add a second provider

Adding a new provider requires only a new adapter file and registration. No service, schema, or domain change is required.

1. **Create the adapter folder** under `packages/provider-sdk/src/<provider>/`.
2. **Implement `IProviderAdapter`** in `<provider>.adapter.ts`.
3. **Add mapper, client, errors, and webhook verification** files.
4. **Register the adapter** in `apps/api` by adding it to the `ProviderLinkModule` providers.
5. **Add the `providerId` constant** to the allowed provider list in `packages/contracts`.

```typescript
// apps/api/src/provider-link/provider-link.module.ts
@Module({
  providers: [
    PlaidAdapter,
    MxAdapter,
    { provide: PLAID_ADAPTER, useExisting: PlaidAdapter },
    { provide: MX_ADAPTER, useExisting: MxAdapter },
    { provide: PROVIDER_REGISTRY, useClass: ProviderRegistry },
  ],
})
export class ProviderLinkModule {}
```

```typescript
// packages/provider-sdk/src/provider-registry.ts
resolve(providerId: string): IProviderAdapter {
  switch (providerId) {
    case 'plaid': return this.plaid;
    case 'mx': return this.mx;
    default: throw new ProviderNotFoundError(providerId);
  }
}
```

## Adapter testing

Adapter tests use fixture-driven HTTP mocks. Provider payloads are captured as JSON fixtures; the test verifies that the adapter maps them correctly to neutral DTOs and handles errors.

- Fixtures live in `packages/provider-sdk/src/plaid/__fixtures__/ `.
- HTTP mocking is done with `msw` or `nock`.
- Coverage target: ≥85% per ADR-0000 §8.

## Consequences

- **Positive**: New providers are added without touching business logic.
- **Positive**: The domain package remains free of provider concepts.
- **Positive**: Tests for services are provider-agnostic.
- **Negative**: The adapter layer must be comprehensive; mapping every provider quirk is ongoing work.
- **Negative**: Provider-neutral DTOs can lag behind provider-specific features until a second provider forces generalization.
