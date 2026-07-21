import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { DrizzleBalanceRepository } from './balance.repository.js';
import * as schema from '../schema/index.js';
import {
  createTestContext,
  isDatabaseAvailable,
  truncateTables,
  seedUser,
  seedIntegration,
  seedConnection,
  seedAccount,
} from './test-helpers.js';
import type { TestContext } from './test-helpers.js';

const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)('DrizzleBalanceRepository', () => {
  let ctx: TestContext;
  let repository: DrizzleBalanceRepository;

  beforeAll(async () => {
    ctx = await createTestContext();
    repository = new DrizzleBalanceRepository(ctx.db);
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await truncateTables(ctx.db);
  });

  async function seedBalance(
    accountId: string,
    overrides?: Partial<typeof schema.balances.$inferInsert>,
  ): Promise<string> {
    const id = uuidv7();
    await ctx.db.insert(schema.balances).values({
      id,
      accountId,
      current: 10000,
      available: 9000,
      limit: null,
      currency: 'USD',
      recordedAt: new Date('2024-01-15T00:00:00Z'),
      ...overrides,
    });
    return id;
  }

  it('findLatestByAccountId returns latest balance', async () => {
    const userId = await seedUser(ctx.db);
    const integrationId = await seedIntegration(ctx.db, userId);
    const connectionId = await seedConnection(ctx.db, integrationId);
    const accountId = await seedAccount(ctx.db, connectionId);

    await seedBalance(accountId, { current: 5000, recordedAt: new Date('2024-01-10T00:00:00Z') });
    await seedBalance(accountId, { current: 7000, recordedAt: new Date('2024-01-20T00:00:00Z') });
    await seedBalance(accountId, { current: 6000, recordedAt: new Date('2024-01-15T00:00:00Z') });

    const latest = await repository.findLatestByAccountId(accountId);

    expect(latest).not.toBeNull();
    expect(latest!.current).toBe(7000);
  });

  it('findLatestByAccountId returns null when no balances exist', async () => {
    const userId = await seedUser(ctx.db);
    const integrationId = await seedIntegration(ctx.db, userId);
    const connectionId = await seedConnection(ctx.db, integrationId);
    const accountId = await seedAccount(ctx.db, connectionId);

    const latest = await repository.findLatestByAccountId(accountId);
    expect(latest).toBeNull();
  });

  it('findByAccountId returns paginated balance history', async () => {
    const userId = await seedUser(ctx.db);
    const integrationId = await seedIntegration(ctx.db, userId);
    const connectionId = await seedConnection(ctx.db, integrationId);
    const accountId = await seedAccount(ctx.db, connectionId);
    const otherAccountId = await seedAccount(ctx.db, connectionId);

    await seedBalance(accountId, { current: 1000, recordedAt: new Date('2024-01-15T00:00:00Z') });
    await seedBalance(accountId, { current: 2000, recordedAt: new Date('2024-01-16T00:00:00Z') });
    await seedBalance(otherAccountId, { current: 9999, recordedAt: new Date('2024-01-17T00:00:00Z') });

    const result = await repository.findByAccountId(accountId, { limit: 10 });

    expect(result.items).toHaveLength(2);
    expect(result.items.map((b) => b.current)).toEqual(expect.arrayContaining([1000, 2000]));
    expect(result.hasMore).toBe(false);
  });

  it('findByAccountId respects cursor pagination', async () => {
    const userId = await seedUser(ctx.db);
    const integrationId = await seedIntegration(ctx.db, userId);
    const connectionId = await seedConnection(ctx.db, integrationId);
    const accountId = await seedAccount(ctx.db, connectionId);

    await seedBalance(accountId, { current: 1000, recordedAt: new Date('2024-01-10T00:00:00Z') });
    await seedBalance(accountId, { current: 2000, recordedAt: new Date('2024-01-15T00:00:00Z') });
    await seedBalance(accountId, { current: 3000, recordedAt: new Date('2024-01-20T00:00:00Z') });

    const firstPage = await repository.findByAccountId(accountId, { limit: 1 });
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.items[0].current).toBe(3000);
    expect(firstPage.hasMore).toBe(true);

    const secondPage = await repository.findByAccountId(accountId, { limit: 1, cursor: firstPage.nextCursor! });
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0].current).toBe(2000);
    expect(secondPage.hasMore).toBe(true);

    const thirdPage = await repository.findByAccountId(accountId, { limit: 1, cursor: secondPage.nextCursor! });
    expect(thirdPage.items).toHaveLength(1);
    expect(thirdPage.items[0].current).toBe(1000);
    expect(thirdPage.hasMore).toBe(false);
  });

  it('create creates balance record', async () => {
    const userId = await seedUser(ctx.db);
    const integrationId = await seedIntegration(ctx.db, userId);
    const connectionId = await seedConnection(ctx.db, integrationId);
    const accountId = await seedAccount(ctx.db, connectionId);

    const balance = await repository.create({
      accountId,
      current: 15000,
      available: 14000,
      limit: 50000,
      currency: 'USD',
      recordedAt: new Date('2024-03-01T12:00:00Z'),
    });

    expect(balance.accountId).toBe(accountId);
    expect(balance.current).toBe(15000);
    expect(balance.available).toBe(14000);
    expect(balance.limit).toBe(50000);
    expect(balance.currency).toBe('USD');
    expect(balance.recordedAt).toEqual(new Date('2024-03-01T12:00:00Z'));
    expect(balance.createdAt).toBeInstanceOf(Date);
  });

  it('create multiple creates produce multiple rows (append-only)', async () => {
    const userId = await seedUser(ctx.db);
    const integrationId = await seedIntegration(ctx.db, userId);
    const connectionId = await seedConnection(ctx.db, integrationId);
    const accountId = await seedAccount(ctx.db, connectionId);

    await repository.create({
      accountId,
      current: 1000,
      available: 900,
      limit: null,
      currency: 'USD',
      recordedAt: new Date('2024-04-01T00:00:00Z'),
    });

    await repository.create({
      accountId,
      current: 2000,
      available: 1900,
      limit: null,
      currency: 'USD',
      recordedAt: new Date('2024-04-02T00:00:00Z'),
    });

    const rows = await ctx.db.select().from(schema.balances).where(eq(schema.balances.accountId, accountId));
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.current)).toEqual(expect.arrayContaining([1000, 2000]));
  });
});

if (!dbAvailable) {
  console.warn('Postgres is unavailable; skipping DrizzleBalanceRepository integration tests');
}
