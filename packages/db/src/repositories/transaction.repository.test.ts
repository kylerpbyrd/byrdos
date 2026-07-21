import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v7 as uuidv7 } from 'uuid';
import { DrizzleTransactionRepository } from './transaction.repository.js';
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

describe.skipIf(!dbAvailable)('DrizzleTransactionRepository', () => {
  let ctx: TestContext;
  let repository: DrizzleTransactionRepository;

  beforeAll(async () => {
    ctx = await createTestContext();
    repository = new DrizzleTransactionRepository(ctx.db);
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await truncateTables(ctx.db);
  });

  async function seedTransaction(
    accountId: string,
    overrides?: Partial<typeof schema.transactions.$inferInsert>,
  ): Promise<string> {
    const id = uuidv7();
    await ctx.db.insert(schema.transactions).values({
      id,
      accountId,
      externalId: `txn-${id}`,
      amountCents: -1000,
      date: '2024-01-15',
      authorizedDate: '2024-01-14',
      name: 'Test Transaction',
      merchantName: 'Test Merchant',
      pending: false,
      pendingTransactionExternalId: null,
      paymentChannel: 'in store',
      isoCurrencyCode: 'USD',
      categoryHash: 'grocery',
      raw: { foo: 'bar' },
      ...overrides,
    });
    return id;
  }

  it('findById returns transaction when exists', async () => {
    const userId = await seedUser(ctx.db);
    const integrationId = await seedIntegration(ctx.db, userId);
    const connectionId = await seedConnection(ctx.db, integrationId);
    const accountId = await seedAccount(ctx.db, connectionId);
    const transactionId = await seedTransaction(accountId, { name: 'Coffee Shop' });

    const transaction = await repository.findById(transactionId);

    expect(transaction).not.toBeNull();
    expect(transaction!.id).toBe(transactionId);
    expect(transaction!.accountId).toBe(accountId);
    expect(transaction!.name).toBe('Coffee Shop');
    expect(transaction!.amountCents).toBe(-1000);
    expect(transaction!.pending).toBe(false);
  });

  it('findByAccountId returns paginated transactions for account', async () => {
    const userId = await seedUser(ctx.db);
    const integrationId = await seedIntegration(ctx.db, userId);
    const connectionId = await seedConnection(ctx.db, integrationId);
    const accountId = await seedAccount(ctx.db, connectionId);
    const otherAccountId = await seedAccount(ctx.db, connectionId);

    await seedTransaction(accountId, { date: '2024-01-15', name: 'Tx A' });
    await seedTransaction(accountId, { date: '2024-01-14', name: 'Tx B' });
    await seedTransaction(otherAccountId, { date: '2024-01-13', name: 'Tx C' });

    const result = await repository.findByAccountId(accountId, { limit: 10 });

    expect(result.items).toHaveLength(2);
    expect(result.items.map((t) => t.name)).toEqual(expect.arrayContaining(['Tx A', 'Tx B']));
    expect(result.hasMore).toBe(false);
  });

  it('findByAccountId filters by startDate and endDate', async () => {
    const userId = await seedUser(ctx.db);
    const integrationId = await seedIntegration(ctx.db, userId);
    const connectionId = await seedConnection(ctx.db, integrationId);
    const accountId = await seedAccount(ctx.db, connectionId);

    await seedTransaction(accountId, { date: '2024-01-10', name: 'Early' });
    await seedTransaction(accountId, { date: '2024-01-15', name: 'Mid' });
    await seedTransaction(accountId, { date: '2024-01-20', name: 'Late' });

    const result = await repository.findByAccountId(accountId, {
      startDate: '2024-01-12',
      endDate: '2024-01-18',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Mid');
  });

  it('findByAccountId filters by pending status', async () => {
    const userId = await seedUser(ctx.db);
    const integrationId = await seedIntegration(ctx.db, userId);
    const connectionId = await seedConnection(ctx.db, integrationId);
    const accountId = await seedAccount(ctx.db, connectionId);

    await seedTransaction(accountId, { date: '2024-01-15', name: 'Pending Tx', pending: true });
    await seedTransaction(accountId, { date: '2024-01-14', name: 'Posted Tx', pending: false });

    const pending = await repository.findByAccountId(accountId, { pending: true });
    expect(pending.items).toHaveLength(1);
    expect(pending.items[0].name).toBe('Pending Tx');

    const posted = await repository.findByAccountId(accountId, { pending: false });
    expect(posted.items).toHaveLength(1);
    expect(posted.items[0].name).toBe('Posted Tx');
  });

  it('findByAccountIdAndUserId returns transactions scoped to user and account', async () => {
    const userA = await seedUser(ctx.db);
    const integrationA = await seedIntegration(ctx.db, userA);
    const connectionA = await seedConnection(ctx.db, integrationA);
    const accountA = await seedAccount(ctx.db, connectionA);

    const userB = await seedUser(ctx.db);
    const integrationB = await seedIntegration(ctx.db, userB);
    const connectionB = await seedConnection(ctx.db, integrationB);
    const accountB = await seedAccount(ctx.db, connectionB);

    await seedTransaction(accountA, { name: 'User A Tx' });
    await seedTransaction(accountB, { name: 'User B Tx' });

    const result = await repository.findByAccountIdAndUserId(accountA, userA, { limit: 10 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('User A Tx');
  });

  it('findByAccountIdAndUserId returns empty when account belongs to another user', async () => {
    const userA = await seedUser(ctx.db);
    const integrationA = await seedIntegration(ctx.db, userA);
    const connectionA = await seedConnection(ctx.db, integrationA);
    const accountA = await seedAccount(ctx.db, connectionA);

    const userB = await seedUser(ctx.db);
    const result = await repository.findByAccountIdAndUserId(accountA, userB, { limit: 10 });
    expect(result.items).toHaveLength(0);
  });

  it('findByAccountId respects cursor pagination', async () => {
    const userId = await seedUser(ctx.db);
    const integrationId = await seedIntegration(ctx.db, userId);
    const connectionId = await seedConnection(ctx.db, integrationId);
    const accountId = await seedAccount(ctx.db, connectionId);

    await seedTransaction(accountId, { date: '2024-01-10', name: 'Oldest' });
    await seedTransaction(accountId, { date: '2024-01-15', name: 'Middle' });
    await seedTransaction(accountId, { date: '2024-01-20', name: 'Newest' });

    const firstPage = await repository.findByAccountId(accountId, { limit: 1 });
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.items[0].name).toBe('Newest');
    expect(firstPage.hasMore).toBe(true);

    const secondPage = await repository.findByAccountId(accountId, {
      limit: 1,
      cursor: firstPage.nextCursor!,
    });
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0].name).toBe('Middle');
    expect(secondPage.hasMore).toBe(true);

    const thirdPage = await repository.findByAccountId(accountId, {
      limit: 1,
      cursor: secondPage.nextCursor!,
    });
    expect(thirdPage.items).toHaveLength(1);
    expect(thirdPage.items[0].name).toBe('Oldest');
    expect(thirdPage.hasMore).toBe(false);
  });

  it('findByUserId returns transactions across user accounts', async () => {
    const userA = await seedUser(ctx.db);
    const integrationA = await seedIntegration(ctx.db, userA);
    const connectionA = await seedConnection(ctx.db, integrationA);
    const accountA = await seedAccount(ctx.db, connectionA);

    const userB = await seedUser(ctx.db);
    const integrationB = await seedIntegration(ctx.db, userB);
    const connectionB = await seedConnection(ctx.db, integrationB);
    const accountB = await seedAccount(ctx.db, connectionB);

    await seedTransaction(accountA, { date: '2024-01-15', name: 'User A Tx' });
    await seedTransaction(accountB, { date: '2024-01-14', name: 'User B Tx' });

    const result = await repository.findByUserId(userA);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('User A Tx');
  });

  it('upsert creates new transaction on first call', async () => {
    const userId = await seedUser(ctx.db);
    const integrationId = await seedIntegration(ctx.db, userId);
    const connectionId = await seedConnection(ctx.db, integrationId);
    const accountId = await seedAccount(ctx.db, connectionId);

    const transaction = await repository.upsert({
      accountId,
      externalId: 'ext-txn-1',
      amountCents: -2500,
      date: '2024-02-01',
      authorizedDate: '2024-01-31',
      name: 'Grocery Store',
      merchantName: 'Whole Foods',
      pending: false,
      pendingTransactionExternalId: null,
      paymentChannel: 'in store',
      isoCurrencyCode: 'USD',
      categoryHash: 'grocery',
      raw: { category: ['Food'] },
    });

    expect(transaction.accountId).toBe(accountId);
    expect(transaction.externalId).toBe('ext-txn-1');
    expect(transaction.amountCents).toBe(-2500);
    expect(transaction.name).toBe('Grocery Store');
    expect(transaction.merchantName).toBe('Whole Foods');
    expect(transaction.categoryHash).toBe('grocery');
    expect(transaction.raw).toEqual({ category: ['Food'] });
  });

  it('upsert updates existing transaction on conflict', async () => {
    const userId = await seedUser(ctx.db);
    const integrationId = await seedIntegration(ctx.db, userId);
    const connectionId = await seedConnection(ctx.db, integrationId);
    const accountId = await seedAccount(ctx.db, connectionId);

    const first = await repository.upsert({
      accountId,
      externalId: 'ext-txn-2',
      amountCents: -1000,
      date: '2024-02-01',
      authorizedDate: null,
      name: 'Initial Name',
      merchantName: 'Initial Merchant',
      pending: true,
      pendingTransactionExternalId: null,
      paymentChannel: 'online',
      isoCurrencyCode: 'USD',
      categoryHash: 'unknown',
      raw: { initial: true },
    });

    const second = await repository.upsert({
      accountId,
      externalId: 'ext-txn-2',
      amountCents: -1200,
      date: '2024-02-02',
      authorizedDate: '2024-02-01',
      name: 'Updated Name',
      merchantName: 'Updated Merchant',
      pending: false,
      pendingTransactionExternalId: null,
      paymentChannel: 'in store',
      isoCurrencyCode: 'USD',
      categoryHash: 'dining',
      raw: { updated: true },
    });

    expect(second.id).toBe(first.id);
    expect(second.amountCents).toBe(-1200);
    expect(second.date).toBe('2024-02-02');
    expect(second.authorizedDate).toBe('2024-02-01');
    expect(second.name).toBe('Updated Name');
    expect(second.merchantName).toBe('Updated Merchant');
    expect(second.pending).toBe(false);
    expect(second.categoryHash).toBe('dining');
    expect(second.raw).toEqual({ updated: true });
  });

  it('updateCategory updates category hash', async () => {
    const userId = await seedUser(ctx.db);
    const integrationId = await seedIntegration(ctx.db, userId);
    const connectionId = await seedConnection(ctx.db, integrationId);
    const accountId = await seedAccount(ctx.db, connectionId);
    const transactionId = await seedTransaction(accountId, { categoryHash: 'old-category' });

    const updated = await repository.updateCategory(transactionId, 'new-category');

    expect(updated.id).toBe(transactionId);
    expect(updated.categoryHash).toBe('new-category');
  });
});

if (!dbAvailable) {
  console.warn('Postgres is unavailable; skipping DrizzleTransactionRepository integration tests');
}
