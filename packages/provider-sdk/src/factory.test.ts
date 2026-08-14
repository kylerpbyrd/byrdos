import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createProviderRegistry } from './factory.js';
import { FakeProviderAdapter } from './adapters/fake.adapter.js';
import { ProviderRegistry } from './registry.js';
import type { ProviderConnection, SyncCursor } from '@byrdos/contracts';

describe('createProviderRegistry', () => {
  let originalProvider: string | undefined;
  let originalClientId: string | undefined;
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalProvider = process.env.PROVIDER;
    originalClientId = process.env.PLAID_CLIENT_ID;
    originalSecret = process.env.PLAID_SECRET;
    delete process.env.PROVIDER;
    delete process.env.PLAID_CLIENT_ID;
    delete process.env.PLAID_SECRET;
  });

  afterEach(() => {
    process.env.PROVIDER = originalProvider;
    process.env.PLAID_CLIENT_ID = originalClientId;
    process.env.PLAID_SECRET = originalSecret;
  });

  it('should return an empty registry when no provider env vars are set', () => {
    const registry = createProviderRegistry();

    expect(registry).toBeInstanceOf(ProviderRegistry);
    expect(registry.list()).toHaveLength(0);
  });

  it('should register FakeProviderAdapter when PROVIDER=fake', () => {
    process.env.PROVIDER = 'fake';

    const registry = createProviderRegistry();

    expect(registry.list()).toEqual(['plaid']);
    const adapter = registry.get('plaid');
    expect(adapter).toBeInstanceOf(FakeProviderAdapter);
  });

  it('should prefer fake provider over Plaid env vars', () => {
    process.env.PROVIDER = 'fake';
    process.env.PLAID_CLIENT_ID = 'client-123';
    process.env.PLAID_SECRET = 'secret-456';

    const registry = createProviderRegistry();

    expect(registry.list()).toEqual(['plaid']);
    expect(registry.get('plaid')).toBeInstanceOf(FakeProviderAdapter);
  });
});

describe('FakeProviderAdapter', () => {
  const adapter = new FakeProviderAdapter();
  const fakeConnection: ProviderConnection = {
    id: 'conn-fake',
    integrationId: 'int-fake',
    externalId: 'fake-item-1',
    providerId: 'plaid',
    institutionName: 'Fake Bank',
    status: 'active',
    lastWebhookAt: null,
    createdAt: '2026-01-01T00:00:00Z',
  };
  const fakeCursor: SyncCursor = {
    resourceType: 'transactions',
    cursor: '',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  it('should expose providerId plaid', () => {
    expect(adapter.providerId).toBe('plaid');
  });

  it('should return a deterministic link token', async () => {
    const result = await adapter.initiateLink('user-1', 'https://example.com/callback');

    expect(result).toEqual({
      token: 'fake-link-token',
      expiration: '2099-12-31T23:59:59Z',
    });
  });

  it('should return a deterministic re-link token', async () => {
    const result = await adapter.initiateRelink(fakeConnection);

    expect(result).toEqual({
      token: 'fake-relink-token',
      expiration: '2099-12-31T23:59:59Z',
    });
  });

  it('should exchange a public token deterministically', async () => {
    const result = await adapter.exchangePublicToken({ publicToken: 'public-123' });

    expect(result.accessToken).toBe('fake-access-token');
    expect(result.connection.externalId).toBe('fake-item-1');
    expect(result.connection.providerId).toBe('plaid');
    expect(result.connection.institutionName).toBe('Fake Bank');
    expect(result.connection.status).toBe('active');
  });

  it('should return two fixed accounts with cents balances', async () => {
    const accounts = await adapter.listAccounts(fakeConnection);

    expect(accounts).toHaveLength(2);
    expect(accounts[0]).toMatchObject({
      externalId: 'fake-acc-checking',
      name: 'Fake Checking',
      type: 'depository',
      subtype: 'checking',
      balanceAvailable: 100000,
      balanceCurrent: 100000,
      balanceLimit: null,
      currency: 'USD',
    });
    expect(accounts[1]).toMatchObject({
      externalId: 'fake-acc-credit',
      name: 'Fake Credit Card',
      type: 'credit',
      subtype: 'credit card',
      balanceAvailable: 450000,
      balanceCurrent: 500000,
      balanceLimit: 500000,
      currency: 'USD',
    });
  });

  it('should return balances matching the fixed accounts', async () => {
    const balances = await adapter.getBalances(fakeConnection);

    expect(balances).toHaveLength(2);
    expect(balances[0]).toMatchObject({
      accountExternalId: 'fake-acc-checking',
      available: 100000,
      current: 100000,
      limit: null,
      currency: 'USD',
    });
    expect(balances[1]).toMatchObject({
      accountExternalId: 'fake-acc-credit',
      available: 450000,
      current: 500000,
      limit: 500000,
      currency: 'USD',
    });
  });

  it('should filter balances by accountExternalIds', async () => {
    const balances = await adapter.getBalances(fakeConnection, ['fake-acc-checking']);

    expect(balances).toHaveLength(1);
    expect(balances[0].accountExternalId).toBe('fake-acc-checking');
  });

  it('should yield one transaction batch with two added transactions', async () => {
    const batches = [];
    for await (const batch of adapter.listTransactions(fakeConnection, fakeCursor, {
      start: '2026-01-01',
      end: '2026-01-31',
    })) {
      batches.push(batch);
    }

    expect(batches).toHaveLength(1);
    const [batch] = batches;
    expect(batch.added).toHaveLength(2);
    expect(batch.modified).toHaveLength(0);
    expect(batch.removed).toHaveLength(0);
    expect(batch.nextCursor).toBe('fake-cursor');
    expect(batch.hasMore).toBe(false);

    expect(batch.added[0]).toMatchObject({
      externalId: 'tx-1',
      accountExternalId: 'fake-acc-checking',
      amount: -2500,
      name: 'Fake Grocery Store',
    });
    expect(batch.added[1]).toMatchObject({
      externalId: 'tx-2',
      accountExternalId: 'fake-acc-credit',
      amount: 9999,
      name: 'Fake Employer',
    });
  });

  it('should return connection unchanged from refreshCredentials', async () => {
    const result = await adapter.refreshCredentials(fakeConnection);

    expect(result).toBe(fakeConnection);
  });

  it('should no-op on revoke', async () => {
    await expect(adapter.revoke(fakeConnection)).resolves.toBeUndefined();
  });

  it('should acknowledge webhooks as ignored', async () => {
    const result = await adapter.handleWebhook({
      providerId: 'plaid',
      payload: {},
      signature: 'fake-signature',
      webhookType: 'TEST',
      webhookCode: 'TEST',
    });

    expect(result).toEqual({
      acknowledged: true,
      action: 'ignored',
      message: 'fake',
    });
  });
});
