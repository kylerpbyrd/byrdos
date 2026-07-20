# Domain-Driven Design

byrdOS is organized around bounded contexts, aggregates, and domain events. This keeps business rules co-located, prevents cross-context leakage, and makes the system safe for specialized agents to modify in isolation.

These patterns implement ADR-0000 §3 (domain-driven design) and §4 (modular architecture and clear ownership boundaries). The database strategy that supports them is ADR-0002.

## Bounded contexts

A bounded context is a cohesive business capability with its own ubiquitous language, invariants, and data ownership. Each context maps to one NestJS module and one folder tree.

| Context | Responsibility | Example aggregate roots |
|---|---|---|
| **Identity** | User accounts, sessions, authz claims | `User`, `Session` |
| **ProviderLink** | Linking external financial providers | `Integration`, `Credential`, `ProviderConnection` |
| **Account** | Provider accounts and balances | `Account`, `Balance` |
| **Transaction** | Posted transactions and classification | `Transaction`, `Category` |
| **Sync** | Sync jobs, cursors, orchestration | `SyncJob`, `SyncCursor` |
| **Budget-v2** | Budget envelopes and tracking | `Budget`, `BudgetEntry` |
| **Transfer-v2** | Internal and external money movement | `Transfer`, `TransferSchedule` |
| **Insight-v3** | Derived analytics and recommendations | `Insight`, `Report` |

Cross-context communication happens through domain events. A service inside one context does not import a service from another context directly.

## Aggregates as consistency boundaries

An aggregate is a cluster of entities and value objects treated as a single unit for data changes. The aggregate root is the only entity that outside code may reference directly.

### Rules

- **One aggregate per transaction**. A repository persists exactly one aggregate root per transaction, per ADR-0000 §3.
- **Invariants inside the aggregate**. Business rules that span child entities are enforced by the aggregate root, not by application services.
- **Small aggregates**. Aggregates are kept small to reduce lock contention and make reasoning easier.

### Example aggregates

```typescript
// packages/domain/src/provider-link/integration.ts
export class Integration {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly providerId: string,
    public status: IntegrationStatus,
    public readonly createdAt: Date,
    private _connections: ProviderConnection[] = [],
  ) {}

  addConnection(connection: ProviderConnection): void {
    this._connections.push(connection);
    this.status = 'active';
  }

  requireRelink(): void {
    this.status = 'relink_required';
  }
}
```

```typescript
// packages/domain/src/account/account.ts
export class Account {
  constructor(
    public readonly id: string,
    public readonly connectionId: string,
    public readonly externalId: string,
    public name: string,
    public type: AccountType,
    public currentBalanceCents: number,
    private _balances: Balance[] = [],
  ) {}

  recordBalance(availableCents: number, currentCents: number): Balance {
    const balance = new Balance(/* ... */);
    this._balances.push(balance);
    this.currentBalanceCents = currentCents;
    return balance;
  }
}
```

## The domain package

`packages/domain` is the pure heart of the system.

- **Zero I/O**. No network, filesystem, or database calls.
- **Zero framework imports**. No NestJS, no React, no Drizzle.
- **Junior-agent readable**. A new agent can read this package in isolation and understand the business rules.

Domain packages are organized by context:

```
packages/domain/src/
├─ identity/
│  ├─ user.ts
│  ├─ session.ts
│  └─ index.ts
├─ provider-link/
│  ├─ integration.ts
│  ├─ credential.ts
│  ├─ provider-connection.ts
│  └─ index.ts
├─ account/
│  ├─ account.ts
│  ├─ balance.ts
│  └─ index.ts
├─ transaction/
│  ├─ transaction.ts
│  ├─ category.ts
│  └─ index.ts
├─ sync/
│  ├─ sync-job.ts
│  ├─ sync-cursor.ts
│  └─ index.ts
├─ budget/
├─ transfer/
├─ insight/
└─ index.ts
```

## Domain events for cross-context communication

When something significant happens inside a context, the aggregate emits a domain event. Other contexts react by subscribing to the event, not by calling the originating service.

### Event shape

```typescript
export interface DomainEvent {
  readonly type: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: Record<string, unknown>;
  readonly version: number;
  readonly occurredAt: Date;
}
```

### Key v1 events

| Event | Emitted by | Handled by |
|---|---|---|
| `IntegrationLinked` | ProviderLink | Sync, Account |
| `ProviderConnectionCreated` | ProviderLink | Sync |
| `AccountsSynced` | Account | Sync |
| `TransactionsFetched` | Sync | Transaction |
| `TransactionClassified` | Transaction | Insight, Budget |
| `RelinkRequired` | ProviderLink | Web, Notification |
| `SyncCompleted` | Sync | Insight, Notification |

### In-process dispatch

Inside `apps/api` and services, `EventEmitter2` dispatches domain events in-process. Handlers are idempotent and operate on their own aggregate.

```typescript
@OnEvent('provider-link.relink-required')
async handleRelinkRequired(event: RelinkRequiredEvent) {
  await this.notificationService.promptRelink(event.userId, event.connectionId);
}
```

For cross-process delivery, domain events are persisted to the `EventLog` outbox table and relayed to Redis Streams by the `OutboxRelay` worker. See `events.md` for the full event architecture.

## Repository pattern

The repository pattern decouples domain logic from persistence technology.

### Interface in domain, implementation in db

- **Interface** lives in `packages/domain` (or `packages/contracts` for cross-package contracts).
- **Implementation** lives in `packages/db` using Drizzle.

```typescript
// packages/domain/src/account/account.repository.ts
export interface IAccountRepository {
  findById(id: string): Promise<Account | null>;
  findByConnectionId(connectionId: string): Promise<Account[]>;
  save(account: Account): Promise<void>;
}
```

```typescript
// packages/db/src/account/account.repository.ts
@Injectable()
export class AccountRepository implements IAccountRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async findById(id: string): Promise<Account | null> {
    const row = await this.db.query.accounts.findFirst({ where: eq(accounts.id, id) });
    return row ? this.toDomain(row) : null;
  }

  async save(account: Account): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(accounts).values(this.toRow(account));
      for (const balance of account.newBalances) {
        await tx.insert(balances).values(balance);
      }
    });
  }

  private toDomain(row: AccountRow): Account { /* ... */ }
  private toRow(account: Account): AccountInsert { /* ... */ }
}
```

### Rules

- Repositories return domain entities, not Drizzle rows.
- Mapping between rows and entities happens inside the repository implementation.
- Query builders are not leaked to services or controllers.
- One aggregate root per transaction.

## Value objects

Value objects have no identity and are immutable. They encapsulate validation and formatting.

```typescript
export class Money {
  private constructor(
    public readonly cents: number,
    public readonly currency: string,
  ) {}

  static fromCents(cents: number, currency = 'USD'): Money {
    if (!Number.isInteger(cents)) throw new Error('Money must be integer cents');
    return new Money(cents, currency);
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) throw new Error('Currency mismatch');
    return new Money(this.cents + other.cents, this.currency);
  }
}
```

## Anti-corruption layer

External provider models are translated into domain models at the adapter boundary. The `provider-sdk` package contains the anti-corruption layer for financial aggregators. Provider-specific types do not cross into `packages/domain`. See `provider-abstraction.md` for the adapter contract.

## Consequences

- **Positive**: Business rules are isolated and testable without a database.
- **Positive**: Teams can work in parallel within their bounded contexts.
- **Positive**: Adding a new context requires no changes to existing ones beyond subscribing to events.
- **Negative**: Eventual consistency across contexts must be modeled explicitly.
- **Negative**: Small, focused aggregates can require more transactions than a single large aggregate.
