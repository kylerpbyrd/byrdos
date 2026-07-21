import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DrizzleAccountRepository } from './account.repository.js';
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

describe.skipIf(!dbAvailable)('DrizzleAccountRepository', () => {
  let ctx: TestContext;
  let repository: DrizzleAccountRepository;

  beforeAll(async () => {
    ctx = await createTestContext();
    repository = new DrizzleAccountRepository(ctx.db);
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await truncateTables(ctx.db);
  });

  it('findById returns account when exists', async () => {
    const userId = await seedUser(ctx.db);
    const integrationId = await seedIntegration(ctx.db, userId);
    const connectionId = await seedConnection(ctx.db, integrationId);
    const accountId = await seedAccount(ctx.db, connectionId, {
      name: 'Checking Account',
      type: 'depository',
      currentBalanceCents: 5000,
      availableBalanceCents: 4500,
      balanceLimitCents: null,
      currency: 'USD',
      status: 'active',
    });

    const account = await repository.findById(accountId);

    expect(account).not.toBeNull();
    expect(account!.id).toBe(accountId);
    expect(account!.connectionId).toBe(connectionId);
    expect(account!.name).toBe('Checking Account');
    expect(account!.type).toBe('depository');
    expect(account!.currentBalanceCents).toBe(5000);
    expect(account!.availableBalanceCents).toBe(4500);
    expect(account!.currency).toBe('USD');
    expect(account!.status).toBe('active');
  });

  it('findById returns null when not found', async () => {
    const account = await repository.findById('non-existent-id');
    expect(account).toBeNull();
  });

  it('findByIdAndUserId returns account when owned by user', async () => {
    const userId = await seedUser(ctx.db);
    const integrationId = await seedIntegration(ctx.db, userId);
    const connectionId = await seedConnection(ctx.db, integrationId);
    const accountId = await seedAccount(ctx.db, connectionId, { name: 'Owned Account' });

    const account = await repository.findByIdAndUserId(accountId, userId);
    expect(account).not.toBeNull();
    expect(account!.id).toBe(accountId);
  });

  it('findByIdAndUserId returns null when account belongs to another user', async () => {
    const userA = await seedUser(ctx.db);
    const integrationA = await seedIntegration(ctx.db, userA);
    const connectionA = await seedConnection(ctx.db, integrationA);
    const accountId = await seedAccount(ctx.db, connectionA);

    const userB = await seedUser(ctx.db);
    const account = await repository.findByIdAndUserId(accountId, userB);
    expect(account).toBeNull();
  });

  it('findByConnectionId returns all accounts for a connection', async () => {
    const userId = await seedUser(ctx.db);
    const integrationId = await seedIntegration(ctx.db, userId);
    const connectionId = await seedConnection(ctx.db, integrationId);
    const otherConnectionId = await seedConnection(ctx.db, integrationId);

    await seedAccount(ctx.db, connectionId, { name: 'Account A' });
    await seedAccount(ctx.db, connectionId, { name: 'Account B' });
    await seedAccount(ctx.db, otherConnectionId, { name: 'Account C' });

    const accounts = await repository.findByConnectionId(connectionId);

    expect(accounts).toHaveLength(2);
    expect(accounts.map((a) => a.name)).toEqual(expect.arrayContaining(['Account A', 'Account B']));
  });

  it('findByConnectionId returns empty array for unknown connection', async () => {
    const accounts = await repository.findByConnectionId('unknown-connection-id');
    expect(accounts).toEqual([]);
  });

  it('findByUserId returns paginated accounts with correct userId filter', async () => {
    const userA = await seedUser(ctx.db);
    const integrationA = await seedIntegration(ctx.db, userA);
    const connectionA = await seedConnection(ctx.db, integrationA);
    await seedAccount(ctx.db, connectionA, { name: 'User A Account' });

    const userB = await seedUser(ctx.db);
    const integrationB = await seedIntegration(ctx.db, userB);
    const connectionB = await seedConnection(ctx.db, integrationB);
    await seedAccount(ctx.db, connectionB, { name: 'User B Account' });

    const result = await repository.findByUserId(userA);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('User A Account');
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('findByUserId respects cursor pagination', async () => {
    const userId = await seedUser(ctx.db);
    const integrationId = await seedIntegration(ctx.db, userId);
    const connectionId = await seedConnection(ctx.db, integrationId);

    await seedAccount(ctx.db, connectionId, { id: 'acct-pagination-001', name: 'Account 1' });
    await seedAccount(ctx.db, connectionId, { id: 'acct-pagination-002', name: 'Account 2' });
    await seedAccount(ctx.db, connectionId, { id: 'acct-pagination-003', name: 'Account 3' });

    const firstPage = await repository.findByUserId(userId, { limit: 1 });
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await repository.findByUserId(userId, {
      limit: 1,
      cursor: firstPage.nextCursor!,
    });
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.hasMore).toBe(true);
    expect(secondPage.nextCursor).not.toBeNull();
    expect(secondPage.items[0].id).not.toBe(firstPage.items[0].id);

    const thirdPage = await repository.findByUserId(userId, {
      limit: 1,
      cursor: secondPage.nextCursor!,
    });
    expect(thirdPage.items).toHaveLength(1);
    expect(thirdPage.hasMore).toBe(false);
    expect(thirdPage.nextCursor).toBeNull();

    const names = [firstPage.items[0].name, secondPage.items[0].name, thirdPage.items[0].name];
    expect(names).toEqual(['Account 1', 'Account 2', 'Account 3']);
  });

  it('findByUserId returns empty when no accounts', async () => {
    const userId = await seedUser(ctx.db);
    const result = await repository.findByUserId(userId);
    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('create creates and returns account with all fields', async () => {
    const userId = await seedUser(ctx.db);
    const integrationId = await seedIntegration(ctx.db, userId);
    const connectionId = await seedConnection(ctx.db, integrationId);

    const account = await repository.create({
      connectionId,
      externalId: 'external-account-1',
      mask: '1234',
      name: 'Savings',
      officialName: 'Official Savings Account',
      type: 'depository',
      subtype: 'savings',
      currentBalanceCents: 100000,
      availableBalanceCents: 95000,
      balanceLimitCents: null,
      currency: 'USD',
      status: 'active',
    });

    expect(account.connectionId).toBe(connectionId);
    expect(account.externalId).toBe('external-account-1');
    expect(account.mask).toBe('1234');
    expect(account.name).toBe('Savings');
    expect(account.officialName).toBe('Official Savings Account');
    expect(account.type).toBe('depository');
    expect(account.subtype).toBe('savings');
    expect(account.currentBalanceCents).toBe(100000);
    expect(account.availableBalanceCents).toBe(95000);
    expect(account.balanceLimitCents).toBeNull();
    expect(account.currency).toBe('USD');
    expect(account.status).toBe('active');
    expect(account.createdAt).toBeInstanceOf(Date);
    expect(account.updatedAt).toBeInstanceOf(Date);
  });

  it('updateBalance updates balance fields and updatedAt', async () => {
    const userId = await seedUser(ctx.db);
    const integrationId = await seedIntegration(ctx.db, userId);
    const connectionId = await seedConnection(ctx.db, integrationId);
    const accountId = await seedAccount(ctx.db, connectionId, {
      currentBalanceCents: 1000,
      availableBalanceCents: 900,
    });

    const before = await repository.findById(accountId);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const updated = await repository.updateBalance(accountId, 2000, 1800, 5000);

    expect(updated.currentBalanceCents).toBe(2000);
    expect(updated.availableBalanceCents).toBe(1800);
    expect(updated.balanceLimitCents).toBe(5000);
    expect(updated.updatedAt.getTime()).toBeGreaterThan(before!.updatedAt.getTime());
  });

  it('updateStatus changes status', async () => {
    const userId = await seedUser(ctx.db);
    const integrationId = await seedIntegration(ctx.db, userId);
    const connectionId = await seedConnection(ctx.db, integrationId);
    const accountId = await seedAccount(ctx.db, connectionId, { status: 'active' });

    const updated = await repository.updateStatus(accountId, 'closed');

    expect(updated.status).toBe('closed');
  });
});

if (!dbAvailable) {
  console.warn('Postgres is unavailable; skipping DrizzleAccountRepository integration tests');
}
