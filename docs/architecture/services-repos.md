# Services and Repositories

byrdOS uses a layered architecture inside the backend: controllers handle HTTP, application services orchestrate use cases, domain services enforce invariants, and repositories persist aggregates. This document defines the layering rule, repository interfaces, NestJS dependency injection strategy, and how worker app contexts reuse the same wiring.

This layering implements ADR-0000 §3 (domain-driven design), §4 (modular architecture), and §7 (interface-first design).

## Layering rule

```
Controller → ApplicationService → DomainService / Repository → DrizzleClient
```

| Layer | Responsibility | Example |
|---|---|---|
| **Controller** | HTTP concerns: routing, validation, serialization, auth guards | `AccountsController` |
| **ApplicationService** | Use-case orchestration: load aggregates, call domain services, save | `SyncAccountsService` |
| **DomainService** | Pure business logic, no I/O | `ClassificationService` |
| **Repository** | Aggregate persistence, mapping to Drizzle | `AccountRepository` |
| **DrizzleClient** | Database connection and query builder | `db` from `packages/db` |

Controllers are thin. Business logic lives in domain services and application services. Repositories are the only layer that talks to the database.

## Controller example

```typescript
@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private readonly appService: SyncAccountsService) {}

  @Post(':connectionId/sync')
  async sync(@Param('connectionId') connectionId: string, @Req() req: AuthenticatedRequest) {
    await this.appService.syncAccounts(req.user.sub, connectionId);
    return { status: 'queued' };
  }
}
```

## Application service example

```typescript
@Injectable()
export class SyncAccountsService {
  constructor(
    private readonly registry: IProviderRegistry,
    private readonly accountRepo: IAccountRepository,
    private readonly jobRepo: ISyncJobRepository,
    private readonly queue: Queue,
  ) {}

  async syncAccounts(userId: string, connectionId: string): Promise<void> {
    const adapter = this.registry.resolve('plaid');
    const connection = await this.getConnection(userId, connectionId);
    const result = await adapter.fetchAccounts({ connection });

    for (const account of result.accounts) {
      await this.accountRepo.save(account);
    }

    await this.jobRepo.create(SyncJob.create(connectionId, 'on-demand'));
    await this.queue.add('sync', { connectionId });
  }
}
```

## Domain services

Domain services contain pure business logic that does not naturally belong to a single aggregate.

```typescript
export class ClassificationService {
  classify(transaction: Transaction, rules: CategoryRule[]): Category {
    for (const rule of rules) {
      if (rule.matches(transaction)) return rule.category;
    }
    return Category.default();
  }
}
```

Domain services are instantiated by application services or wired into NestJS DI if they have dependencies.

## Repository interfaces

Repository interfaces are defined in `packages/domain` (or `packages/contracts` for cross-package contracts). Implementations live in `packages/db`.

### Per-aggregate interfaces

| Aggregate | Interface | Implementation |
|---|---|---|
| User | `IUserRepository` | `UserRepository` |
| Session | `ISessionRepository` | `SessionRepository` |
| Integration | `IIntegrationRepository` | `IntegrationRepository` |
| Credential | `ICredentialRepository` | `CredentialRepository` |
| ProviderConnection | `IProviderConnectionRepository` | `ProviderConnectionRepository` |
| Account | `IAccountRepository` | `AccountRepository` |
| Balance | `IBalanceRepository` | `BalanceRepository` |
| Transaction | `ITransactionRepository` | `TransactionRepository` |
| Category | `ICategoryRepository` | `CategoryRepository` |
| SyncJob | `ISyncJobRepository` | `SyncJobRepository` |
| SyncCursor | `ISyncCursorRepository` | `SyncCursorRepository` |
| EventLog | `IEventLogRepository` | `EventLogRepository` |

### Example interface

```typescript
// packages/domain/src/account/account.repository.ts
export interface IAccountRepository {
  findById(id: string): Promise<Account | null>;
  findByConnectionId(connectionId: string): Promise<Account[]>;
  findByUserId(userId: string): Promise<Account[]>;
  save(account: Account): Promise<void>;
}
```

### Example implementation

```typescript
// packages/db/src/account/account.repository.ts
@Injectable()
export class AccountRepository implements IAccountRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async findById(id: string): Promise<Account | null> {
    const row = await this.db.query.accounts.findFirst({
      where: eq(accounts.id, id),
    });
    return row ? this.toDomain(row) : null;
  }

  async save(account: Account): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(accounts).values(this.toRow(account));
      for (const balance of account.pullNewBalances()) {
        await tx.insert(balances).values(this.toBalanceRow(balance));
      }
    });
  }

  private toDomain(row: AccountRow): Account { /* ... */ }
  private toRow(account: Account): AccountInsert { /* ... */ }
}
```

## NestJS DI strategy

byrdOS uses string or symbol injection tokens to keep domain packages free of NestJS dependencies.

```typescript
// packages/domain/src/tokens.ts
export const DRIZZLE_CLIENT = Symbol('DRIZZLE_CLIENT');
export const IACCOUNT_REPOSITORY = Symbol('IACCOUNT_REPOSITORY');
export const IPROVIDER_REGISTRY = Symbol('IPROVIDER_REGISTRY');
```

### Wiring in apps/api

```typescript
@Module({
  providers: [
    {
      provide: DRIZZLE_CLIENT,
      useValue: createDrizzleClient(),
    },
    {
      provide: IACCOUNT_REPOSITORY,
      useClass: AccountRepository,
    },
    {
      provide: IPROVIDER_REGISTRY,
      useClass: ProviderRegistry,
    },
    SyncAccountsService,
  ],
  controllers: [AccountsController],
})
export class AccountsModule {}
```

### Multi-provider pattern

`IProviderAdapter` is implemented by multiple adapters. The registry resolves the correct adapter at runtime.

```typescript
@Module({
  providers: [
    PlaidAdapter,
    { provide: PLAID_ADAPTER, useExisting: PlaidAdapter },
    { provide: IPROVIDER_REGISTRY, useClass: ProviderRegistry },
  ],
})
export class ProviderLinkModule {}
```

## Worker app contexts

Workers are standalone NestJS app contexts without HTTP servers. They reuse the same DI graph as `apps/api` minus controllers.

```typescript
// services/sync-worker/src/app-context.ts
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SyncWorkerModule, {
    logger: new PinoLogger(),
  });

  const worker = app.get(AccountsWorker);
  await worker.run();
}
```

```typescript
// services/sync-worker/src/sync-worker.module.ts
@Module({
  imports: [
    AccountsModule,
    TransactionsModule,
    SyncModule,
    ProviderSdkModule,
    QueueModule,
    ObservabilityModule,
  ],
})
export class SyncWorkerModule {}
```

This lets workers share repositories, domain services, and adapters with the API without duplicating wiring.

## Consequences

- **Positive**: Layers are independently testable.
- **Positive**: Domain logic has no framework or database dependencies.
- **Positive**: Workers and API share the same DI graph.
- **Negative**: DI wiring is verbose; it is centralized in `apps/api` and service modules.
- **Negative**: Repository mapping adds boilerplate but keeps types explicit.
