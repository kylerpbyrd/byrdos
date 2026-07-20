# Testing Strategy

byrdOS tests every layer of the stack: pure domain logic, repository mappings, application services, provider adapters, API endpoints, workers, frontend flows, and load/security characteristics. Tests are deterministic and use ephemeral resources.

The strategy implements ADR-0000 §8 (testing requirements).

## Coverage targets

| Layer | Target | Tools |
|---|---|---|
| Domain | ≥95% | Vitest |
| Repositories | ≥85% | Vitest + testcontainers |
| Services | ≥85% | Vitest + testcontainers |
| Adapters | ≥85% | Vitest + msw/nock |
| API E2E | Critical flows | Vitest + supertest |
| Workers | Job flows | Vitest + testcontainers + Redis |
| Web | Critical flows | Playwright |
| Contracts | All schemas | Zod + test runner |
| Load | Baseline | k6 |
| Security | OWASP top 10 | Manual + automated scans |

## Domain tests

Domain tests are pure unit tests with no I/O.

```typescript
describe('Money', () => {
  it('rejects float cents', () => {
    expect(() => Money.fromCents(1.23)).toThrow('Money must be integer cents');
  });

  it('adds same currency', () => {
    expect(Money.fromCents(100).add(Money.fromCents(50)).cents).toBe(150);
  });
});
```

## Repository tests

Repository tests use an ephemeral Postgres schema via testcontainers.

```typescript
beforeEach(async () => {
  const container = await new PostgreSqlContainer().start();
  db = createDrizzleClient(container.getConnectionUri());
  await runMigrations(db);
});

afterEach(async () => {
  await container.stop();
});
```

- Each test gets a fresh schema.
- No shared test database.
- Migrations run against the ephemeral database.

## Service tests

Application services are tested with in-memory repository fakes and mocked adapters.

```typescript
const accountRepo = new InMemoryAccountRepository();
const registry = new StubProviderRegistry();
const service = new SyncAccountsService(registry, accountRepo, jobRepo, queue);
```

## Adapter tests

Provider adapters use fixture-driven HTTP mocks.

```typescript
// packages/provider-sdk/src/plaid/__tests__/plaid.adapter.test.ts
server.use(
  http.post('https://sandbox.plaid.com/transactions/get', async () => {
    return HttpResponse.json(transactionsFixture);
  }),
);
```

Coverage target: ≥85% with fixture-driven mocks.

## API E2E tests

API tests run against a test instance of `apps/api` with a real database.

```typescript
const app = await bootstrapTestApi();
await request(app.getHttpServer())
  .post('/accounts/test-connection/sync')
  .set('Authorization', `Bearer ${token}`)
  .expect(202);
```

Critical flows include:

- Sign up / sign in
- Link bank account
- Trigger sync
- View accounts and transactions
- Receive relink prompt

## Worker tests

Worker tests enqueue jobs and assert on database state.

```typescript
await queue.add('accounts', { connectionId: 'conn-1' });
await worker.run();

const accounts = await accountRepo.findByConnectionId('conn-1');
expect(accounts).toHaveLength(2);
```

Redis is run via testcontainers or an embedded Redis server.

## Web tests

Playwright tests cover critical user flows in the browser.

- Sign in
- Connect a bank (mocked Plaid Link)
- View dashboard
- Refresh data
- Mobile viewport tests

## Contract tests

All Zod schemas have test cases for valid and invalid inputs.

```typescript
it('rejects missing email', () => {
  expect(() => LoginRequestSchema.parse({ password: 'x' })).toThrow();
});
```

## Load tests

k6 tests establish baseline performance for:

- `/accounts` list endpoint
- `/transactions` endpoint
- Sync job throughput

Load tests run in staging before prod deploys.

## Security tests

- Static analysis for secrets (git-secrets, detect-secrets).
- Dependency vulnerability scanning (`pnpm audit`).
- OWASP ZAP or similar for API scanning.
- Manual threat model review at milestone gates.

## Shared test harness

`packages/test-utils` provides:

- `PostgresTestHarness` — ephemeral database setup
- `RedisTestHarness` — ephemeral Redis setup
- `UserFactory` — deterministic user fixtures
- `AccountFactory` — account and balance fixtures
- `TransactionFactory` — transaction fixtures
- `PlaidFixtureServer` — mock Plaid responses

## Determinism

Tests must be deterministic. Time-sensitive tests use an injected clock abstraction.

```typescript
const clock = new FixedClock(new Date('2026-01-01T00:00:00Z'));
const service = new TransferService(clock);
```

## CI gate

No pull request merges unless all affected tests pass under a turbo cache miss.

```bash
pnpm turbo run test --force
```

## Consequences

- **Positive**: High coverage reduces regression risk.
- **Positive**: Ephemeral resources prevent test pollution.
- **Negative**: Test suites require containers and can be slow locally.
- **Negative**: Fixture maintenance grows as providers add fields.
