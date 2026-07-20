# Backend Architecture

The byrdOS backend is a NestJS application organized into modules that map to bounded contexts. It exposes REST endpoints, orchestrates application services, enqueues background jobs, and emits domain events. Worker services reuse the same modules without HTTP controllers.

This document inherits ADR-0000 §3 (domain-driven design), §4 (modular architecture), and §7 (interface-first design). The stack is decided in ADR-0001.

## NestJS modules

| Module | Bounded context | Controllers | Services | Workers |
|---|---|---|---|---|
| AuthModule | Identity | `/auth/*` | `AuthService`, `SessionService` | — |
| IdentityModule | Identity | `/users/*` | `UserService` | — |
| ProviderLinkModule | ProviderLink | `/links/*` | `LinkService`, `ExchangeService` | — |
| AccountsModule | Account | `/accounts/*` | `SyncAccountsService`, `BalanceService` | `AccountsWorker` |
| TransactionsModule | Transaction | `/transactions/*` | `TransactionService`, `ClassificationService` | `ClassifyWorker` |
| SyncModule | Sync | `/sync/*` | `SyncOrchestratorService` | `SyncOrchestrator`, `TransactionsWorker` |
| WebhooksModule | ProviderLink | `/webhooks/*` | `WebhookService` | `WebhookWorker` |
| EventsModule | Cross-cutting | — | `EventDispatcherService` | `OutboxRelayWorker` |
| AuditModule | Cross-cutting | — | `AuditService` | — |

## Module structure

Each module folder follows a consistent structure:

```
apps/api/src/accounts/
├─ accounts.module.ts
├─ accounts.controller.ts
├─ application/
│  ├─ sync-accounts.service.ts
│  └─ balance.service.ts
├─ guards/
│  └─ account-owner.guard.ts
└─ index.ts
```

## Controllers

Controllers are thin and delegate to application services.

```typescript
@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(
    private readonly syncService: SyncAccountsService,
    private readonly balanceService: BalanceService,
  ) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    return this.balanceService.listForUser(req.user.sub);
  }

  @Post(':connectionId/sync')
  async sync(
    @Param('connectionId') connectionId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.syncService.syncAccounts(req.user.sub, connectionId);
    return { status: 'queued' };
  }
}
```

## Services

### Application services

Orchestrate use cases by loading aggregates, calling domain services, and saving results.

### Domain services

Contain pure business logic that does not belong to a single aggregate.

### Infrastructure services

Wrap external concerns such as queue producers, event dispatchers, and audit logging.

## Workers

Workers are defined in `services/*` but their handlers live in module folders so they can be reused.

```typescript
// apps/api/src/accounts/workers/accounts.worker.ts
@Processor('accounts')
export class AccountsWorker extends WorkerHost {
  constructor(
    private readonly registry: IProviderRegistry,
    private readonly accountRepo: IAccountRepository,
  ) {
    super();
  }

  async process(job: Job<FetchAccountsJob>): Promise<void> {
    const adapter = this.registry.resolve(job.data.providerId);
    const result = await adapter.fetchAccounts({ connection: job.data.connection });
    for (const account of result.accounts) {
      await this.accountRepo.save(account);
    }
  }
}
```

## Dependency injection strategy

byrdOS uses NestJS DI with symbol tokens to keep domain packages free of framework imports.

```typescript
export const IACCOUNT_REPOSITORY = Symbol('IACCOUNT_REPOSITORY');
export const IPROVIDER_REGISTRY = Symbol('IPROVIDER_REGISTRY');
export const DRIZZLE_CLIENT = Symbol('DRIZZLE_CLIENT');
```

Wiring is centralized in module definitions:

```typescript
@Module({
  providers: [
    { provide: DRIZZLE_CLIENT, useValue: createDrizzleClient() },
    { provide: IACCOUNT_REPOSITORY, useClass: AccountRepository },
    { provide: IPROVIDER_REGISTRY, useClass: ProviderRegistry },
    SyncAccountsService,
    AccountsWorker,
  ],
  controllers: [AccountsController],
})
export class AccountsModule {}
```

## Guard pipeline

Requests pass through a guard pipeline before reaching controllers.

```
HTTPS → CORS → JwtAuthGuard → UserContextGuard → ResourceOwnerGuard → Controller
```

| Guard | Purpose |
|---|---|
| `JwtAuthGuard` | Verify Bearer JWT via JWKS |
| `UserContextGuard` | Attach `userId` to request context for RLS |
| `ResourceOwnerGuard` | Verify user owns the requested resource |

```typescript
@Controller('accounts/:accountId')
@UseGuards(JwtAuthGuard, AccountOwnerGuard)
export class AccountDetailController {}
```

## Interceptors and pipes

- **ZodValidationPipe**: Validates request bodies against Zod schemas from `packages/contracts`.
- **TransformInterceptor**: Serializes responses to DTOs.
- **LoggingInterceptor**: Adds request logs and trace context.
- **ExceptionFilter**: Maps domain errors to HTTP responses.

## API conventions

- RESTful resource paths.
- `202 Accepted` for async operations.
- `GET` for reads, `POST` for commands, `PATCH` for updates.
- Error responses follow a consistent shape:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Invalid request body",
  "path": "/accounts/123/sync"
}
```

## OpenAPI

OpenAPI documentation is generated from controllers and Zod schemas and served at `/docs`.

## Consequences

- **Positive**: Modules map directly to bounded contexts, making ownership clear.
- **Positive**: Workers reuse module logic without HTTP overhead.
- **Negative**: DI wiring is verbose but centralized.
- **Negative**: Guard ordering must be carefully maintained.
