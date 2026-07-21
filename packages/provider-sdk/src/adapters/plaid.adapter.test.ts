import * as crypto from 'crypto';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  mockPlaidLinkToken,
  mockPlaidAccessToken,
  mockPlaidItemId,
  createMockPlaidAccount,
  createMockPlaidTransaction,
} from '@byrdos/test-utils';
import { PlaidAdapter } from './plaid.adapter.js';
import { ProviderError } from '../errors.js';
import type { ProviderConnection, RawWebhook, SyncCursor } from '@byrdos/contracts';

const mockPlaidApi = {
  linkTokenCreate: vi.fn(),
  itemPublicTokenExchange: vi.fn(),
  accountsGet: vi.fn(),
  transactionsSync: vi.fn(),
  itemRemove: vi.fn(),
};

vi.mock('plaid', () => {
  return {
    Configuration: vi.fn(),
    PlaidApi: vi.fn(() => mockPlaidApi),
    PlaidEnvironments: { sandbox: 'sandbox', development: 'development', production: 'production' },
    Products: { Transactions: 'transactions', Auth: 'auth' },
    CountryCode: { Us: 'US' },
  };
});

function createAdapter(): PlaidAdapter {
  return new PlaidAdapter({
    clientId: 'test',
    secret: 'test',
    environment: 'sandbox',
    webhookVerificationKey: 'test-key',
  });
}

function createConnection(accessToken?: string): ProviderConnection {
  const connection: ProviderConnection & { __accessToken?: string } = {
    id: 'conn-1',
    integrationId: 'int-1',
    externalId: mockPlaidItemId,
    providerId: 'plaid',
    institutionName: 'Test Bank',
    status: 'active',
    lastWebhookAt: null,
    createdAt: '2026-01-01T00:00:00Z',
  };
  if (accessToken) {
    connection.__accessToken = accessToken;
  }
  return connection;
}

function createRawWebhook(overrides?: Partial<RawWebhook>): RawWebhook {
  const payload = overrides?.payload ?? { item_id: mockPlaidItemId };
  return {
    providerId: 'plaid',
    payload,
    signature: overrides?.signature ?? createWebhookSignature(payload),
    webhookType: overrides?.webhookType ?? 'TRANSACTIONS',
    webhookCode: overrides?.webhookCode ?? 'SYNC_UPDATES_AVAILABLE',
  };
}

function createWebhookSignature(payload: Record<string, unknown>): string {
  const signed = crypto.createHmac('sha256', 'test-key').update(JSON.stringify(payload)).digest('hex');
  return `t=1234567890,v1=${signed}`;
}

describe('PlaidAdapter', () => {
  let adapter: PlaidAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = createAdapter();
  });

  describe('initiateLink', () => {
    it('should return link token with correct shape', async () => {
      mockPlaidApi.linkTokenCreate.mockResolvedValueOnce({ data: mockPlaidLinkToken });

      const result = await adapter.initiateLink('user-1', 'https://example.com/callback');

      expect(result).toEqual({
        token: mockPlaidLinkToken.link_token,
        expiration: mockPlaidLinkToken.expiration,
      });
      expect(mockPlaidApi.linkTokenCreate).toHaveBeenCalledWith({
        user: { client_user_id: 'user-1' },
        client_name: 'byrdOS',
        products: ['transactions', 'auth'],
        country_codes: ['US'],
        language: 'en',
      });
    });

    it('should propagate Plaid errors', async () => {
      mockPlaidApi.linkTokenCreate.mockRejectedValueOnce({
        response: {
          data: {
            error_type: 'INVALID_REQUEST',
            error_code: 'INVALID_USER',
            error_message: 'invalid user',
          },
        },
      });

      await expect(adapter.initiateLink('user-1', 'https://example.com/callback')).rejects.toMatchObject({
        code: 'invalid_request',
        providerId: 'plaid',
      });
    });
  });

  describe('refreshCredentials', () => {
    it('should return the connection unchanged', async () => {
      const connection = createConnection(mockPlaidAccessToken);
      const result = await adapter.refreshCredentials(connection);

      expect(result).toBe(connection);
    });
  });

  describe('exchangePublicToken', () => {
    it('should exchange public token and return ProviderConnection with item_id', async () => {
      mockPlaidApi.itemPublicTokenExchange.mockResolvedValueOnce({
        data: {
          access_token: mockPlaidAccessToken,
          item_id: mockPlaidItemId,
        },
      });

      const result = await adapter.exchangePublicToken({
        publicToken: 'public-token-123',
        metadata: {
          institution: { name: 'Test Bank', institution_id: 'ins_123' },
        },
      });

      expect(result.externalId).toBe(mockPlaidItemId);
      expect(result.providerId).toBe('plaid');
      expect(result.institutionName).toBe('Test Bank');
      expect(result.status).toBe('active');
      expect(mockPlaidApi.itemPublicTokenExchange).toHaveBeenCalledWith({
        public_token: 'public-token-123',
      });
    });

    it('should propagate Plaid API errors as ProviderError', async () => {
      const plaidError = {
        response: {
          data: {
            error_type: 'INVALID_INPUT',
            error_code: 'INVALID_PUBLIC_TOKEN',
            error_message: 'invalid public token',
          },
        },
      };
      mockPlaidApi.itemPublicTokenExchange.mockRejectedValueOnce(plaidError);

      await expect(
        adapter.exchangePublicToken({ publicToken: 'bad-token' }),
      ).rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(ProviderError);
        expect(error).toMatchObject({
          code: 'invalid_request',
          providerId: 'plaid',
        });
        return true;
      });
    });
  });

  describe('listAccounts', () => {
    it('should throw when access token is missing', async () => {
      await expect(adapter.listAccounts(createConnection())).rejects.toMatchObject({
        code: 'provider_error',
        providerId: 'plaid',
        message: 'Missing access token for connection',
      });
    });

    it('should return normalized accounts with cents conversion', async () => {
      mockPlaidApi.accountsGet.mockResolvedValueOnce({
        data: {
          accounts: [
            createMockPlaidAccount({
              balances: {
                available: 100.5,
                current: 250.75,
                limit: null,
                iso_currency_code: 'USD',
              },
            }),
          ],
        },
      });

      const accounts = await adapter.listAccounts(createConnection(mockPlaidAccessToken));

      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toMatchObject({
        externalId: 'acc-123',
        balanceAvailable: 10050,
        balanceCurrent: 25075,
        balanceLimit: null,
        currency: 'USD',
      });
    });

    it('should handle null balances gracefully', async () => {
      mockPlaidApi.accountsGet.mockResolvedValueOnce({
        data: {
          accounts: [
            createMockPlaidAccount({
              balances: {
                available: null,
                current: null,
                limit: null,
                iso_currency_code: null,
              },
            }),
          ],
        },
      });

      const accounts = await adapter.listAccounts(createConnection(mockPlaidAccessToken));

      expect(accounts[0]).toMatchObject({
        balanceAvailable: null,
        balanceCurrent: 0,
        balanceLimit: null,
        currency: 'USD',
      });
    });
  });

  describe('getBalances', () => {
    it('should throw when access token is missing', async () => {
      await expect(adapter.getBalances(createConnection())).rejects.toMatchObject({
        code: 'provider_error',
        providerId: 'plaid',
        message: 'Missing access token for connection',
      });
    });

    it('should filter by accountExternalIds when provided', async () => {
      mockPlaidApi.accountsGet.mockResolvedValueOnce({
        data: {
          accounts: [
            createMockPlaidAccount({ account_id: 'acc-1', balances: { available: 100, current: 100, limit: null, iso_currency_code: 'USD' } }),
            createMockPlaidAccount({ account_id: 'acc-2', balances: { available: 200, current: 200, limit: null, iso_currency_code: 'USD' } }),
          ],
        },
      });

      const balances = await adapter.getBalances(createConnection(mockPlaidAccessToken), ['acc-2']);

      expect(balances).toHaveLength(1);
      expect(balances[0].accountExternalId).toBe('acc-2');
    });

    it('should return all balances when no filter', async () => {
      mockPlaidApi.accountsGet.mockResolvedValueOnce({
        data: {
          accounts: [
            createMockPlaidAccount({ account_id: 'acc-1' }),
            createMockPlaidAccount({ account_id: 'acc-2' }),
          ],
        },
      });

      const balances = await adapter.getBalances(createConnection(mockPlaidAccessToken));

      expect(balances).toHaveLength(2);
    });
  });

  describe('listTransactions', () => {
    it('should throw when access token is missing', async () => {
      const cursor: SyncCursor = {
        resourceType: 'transactions',
        cursor: '',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      await expect(
        (async () => {
          const results = [];
          for await (const txn of adapter.listTransactions(createConnection(), cursor, { start: '2026-01-01', end: '2026-12-31' })) {
            results.push(txn);
          }
          return results;
        })(),
      ).rejects.toMatchObject({
        code: 'provider_error',
        providerId: 'plaid',
        message: 'Missing access token for connection',
      });
    });

    it('should yield transactions from paginated Plaid responses', async () => {
      mockPlaidApi.transactionsSync
        .mockResolvedValueOnce({
          data: {
            added: [createMockPlaidTransaction({ transaction_id: 'txn-1', amount: -10.0 })],
            modified: [],
            removed: [],
            next_cursor: 'cursor-2',
            has_more: true,
          },
        })
        .mockResolvedValueOnce({
          data: {
            added: [createMockPlaidTransaction({ transaction_id: 'txn-2', amount: 20.0 })],
            modified: [],
            removed: [],
            next_cursor: 'cursor-3',
            has_more: false,
          },
        });

      const cursor: SyncCursor = {
        resourceType: 'transactions',
        cursor: '',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      const txns: Array<{ externalId: string; amount: number }> = [];
      for await (const txn of adapter.listTransactions(createConnection(mockPlaidAccessToken), cursor, { start: '2026-01-01', end: '2026-12-31' })) {
        txns.push({ externalId: txn.externalId, amount: txn.amount });
      }

      expect(txns).toEqual([
        { externalId: 'txn-1', amount: -1000 },
        { externalId: 'txn-2', amount: 2000 },
      ]);
      expect(mockPlaidApi.transactionsSync).toHaveBeenCalledTimes(2);
      expect(mockPlaidApi.transactionsSync).toHaveBeenLastCalledWith({
        access_token: mockPlaidAccessToken,
        cursor: 'cursor-2',
      });
    });

    it('should stop when has_more is false', async () => {
      mockPlaidApi.transactionsSync.mockResolvedValueOnce({
        data: {
          added: [createMockPlaidTransaction({ transaction_id: 'txn-1' })],
          modified: [],
          removed: [],
          next_cursor: 'cursor-final',
          has_more: false,
        },
      });

      const cursor: SyncCursor = {
        resourceType: 'transactions',
        cursor: '',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      const txns = [];
      for await (const txn of adapter.listTransactions(createConnection(mockPlaidAccessToken), cursor, { start: '2026-01-01', end: '2026-12-31' })) {
        txns.push(txn);
      }

      expect(txns).toHaveLength(1);
      expect(mockPlaidApi.transactionsSync).toHaveBeenCalledTimes(1);
    });

    it('should propagate Plaid errors', async () => {
      const plaidError = {
        response: {
          data: {
            error_type: 'ITEM_ERROR',
            error_code: 'ITEM_LOGIN_REQUIRED',
            error_message: 'login required',
          },
        },
      };
      mockPlaidApi.transactionsSync.mockRejectedValueOnce(plaidError);

      const cursor: SyncCursor = {
        resourceType: 'transactions',
        cursor: '',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      await expect(
        (async () => {
          const results = [];
          for await (const txn of adapter.listTransactions(createConnection(mockPlaidAccessToken), cursor, { start: '2026-01-01', end: '2026-12-31' })) {
            results.push(txn);
          }
          return results;
        })(),
      ).rejects.toMatchObject({
        code: 'reauth_required',
        providerId: 'plaid',
      });
    });
  });

  describe('error mapping', () => {
    it('should map RATE_LIMIT_EXCEEDED to provider_unreachable with retryable', async () => {
      mockPlaidApi.itemPublicTokenExchange.mockRejectedValueOnce({
        response: {
          data: {
            error_type: 'RATE_LIMIT_EXCEEDED',
            error_code: 'RATE_LIMIT',
            error_message: 'rate limit exceeded',
          },
        },
      });

      await expect(
        adapter.exchangePublicToken({ publicToken: 'token' }),
      ).rejects.toSatisfy((error: unknown) => {
        expect(error).toMatchObject({
          code: 'provider_unreachable',
          providerId: 'plaid',
          retryable: true,
        });
        return true;
      });
    });

    it('should map API_ERROR to provider_unreachable', async () => {
      mockPlaidApi.itemPublicTokenExchange.mockRejectedValueOnce({
        response: {
          data: {
            error_type: 'API_ERROR',
            error_code: 'INTERNAL_SERVER_ERROR',
            error_message: 'internal error',
          },
        },
      });

      await expect(
        adapter.exchangePublicToken({ publicToken: 'token' }),
      ).rejects.toMatchObject({
        code: 'provider_unreachable',
        providerId: 'plaid',
      });
    });

    it('should map unknown Plaid errors to provider_error', async () => {
      mockPlaidApi.itemPublicTokenExchange.mockRejectedValueOnce({
        response: {
          data: {
            error_type: 'UNKNOWN_ERROR',
            error_code: 'UNKNOWN',
            error_message: 'unknown error',
          },
        },
      });

      await expect(
        adapter.exchangePublicToken({ publicToken: 'token' }),
      ).rejects.toMatchObject({
        code: 'provider_error',
        providerId: 'plaid',
      });
    });

    it('should map non-Plaid errors to provider_error', async () => {
      mockPlaidApi.itemPublicTokenExchange.mockRejectedValueOnce(new Error('network failure'));

      await expect(
        adapter.exchangePublicToken({ publicToken: 'token' }),
      ).rejects.toMatchObject({
        code: 'provider_error',
        providerId: 'plaid',
        message: 'network failure',
      });
    });
  });

  describe('revoke', () => {
    it('should throw when access token is missing', async () => {
      await expect(adapter.revoke(createConnection())).rejects.toMatchObject({
        code: 'provider_error',
        providerId: 'plaid',
        message: 'Missing access token for connection',
      });
    });

    it('should call itemRemove', async () => {
      mockPlaidApi.itemRemove.mockResolvedValueOnce({ data: { request_id: 'req-1' } });

      await adapter.revoke(createConnection(mockPlaidAccessToken));

      expect(mockPlaidApi.itemRemove).toHaveBeenCalledWith({ access_token: mockPlaidAccessToken });
    });

    it('should propagate Plaid errors', async () => {
      mockPlaidApi.itemRemove.mockRejectedValueOnce({
        response: {
          data: {
            error_type: 'INVALID_REQUEST',
            error_code: 'INVALID_ACCESS_TOKEN',
            error_message: 'invalid access token',
          },
        },
      });

      await expect(adapter.revoke(createConnection(mockPlaidAccessToken))).rejects.toMatchObject({
        code: 'invalid_request',
        providerId: 'plaid',
      });
    });
  });

  describe('handleWebhook', () => {
    it('SYNC_UPDATES_AVAILABLE → sync_triggered', async () => {
      const result = await adapter.handleWebhook(createRawWebhook({ webhookCode: 'SYNC_UPDATES_AVAILABLE' }));

      expect(result).toEqual({
        acknowledged: true,
        action: 'sync_triggered',
        message: 'New transactions available',
      });
    });

    it('ITEM_LOGIN_REQUIRED → reauth_required', async () => {
      const result = await adapter.handleWebhook(createRawWebhook({ webhookCode: 'ITEM_LOGIN_REQUIRED' }));

      expect(result).toEqual({
        acknowledged: true,
        action: 'reauth_required',
        message: 'User needs to re-authenticate',
      });
    });

    it('DEFAULT_UPDATE → sync_triggered', async () => {
      const result = await adapter.handleWebhook(createRawWebhook({ webhookCode: 'DEFAULT_UPDATE' }));

      expect(result).toEqual({
        acknowledged: true,
        action: 'sync_triggered',
        message: 'Account data updated',
      });
    });

    it('INITIAL_UPDATE → sync_triggered', async () => {
      const result = await adapter.handleWebhook(createRawWebhook({ webhookCode: 'INITIAL_UPDATE' }));

      expect(result).toEqual({
        acknowledged: true,
        action: 'sync_triggered',
        message: 'Initial sync complete',
      });
    });

    it('TRANSACTIONS_REMOVED → sync_triggered', async () => {
      const result = await adapter.handleWebhook(createRawWebhook({ webhookCode: 'TRANSACTIONS_REMOVED' }));

      expect(result).toEqual({
        acknowledged: true,
        action: 'sync_triggered',
        message: 'Transactions removed',
      });
    });

    it('ERROR → error action', async () => {
      const result = await adapter.handleWebhook(createRawWebhook({ webhookCode: 'ERROR' }));

      expect(result).toEqual({
        acknowledged: true,
        action: 'error',
        message: 'Plaid reported an error with this item',
      });
    });

    it('PENDING_EXPIRATION → ignored', async () => {
      const result = await adapter.handleWebhook(createRawWebhook({ webhookCode: 'PENDING_EXPIRATION' }));

      expect(result).toEqual({
        acknowledged: true,
        action: 'ignored',
        message: 'Consent expiring soon',
      });
    });

    it('unknown webhook code → ignored', async () => {
      const result = await adapter.handleWebhook(createRawWebhook({ webhookCode: 'UNKNOWN_CODE' }));

      expect(result).toEqual({
        acknowledged: true,
        action: 'ignored',
        message: 'Unhandled webhook code: UNKNOWN_CODE',
      });
    });

    it('should return error when v1 signature is missing', async () => {
      const result = await adapter.handleWebhook(
        createRawWebhook({ signature: 't=1234567890' }),
      );

      expect(result).toMatchObject({
        acknowledged: false,
        action: 'error',
      });
      expect(result.message).toContain('Missing v1 signature');
    });

    it('should return error when signature verification fails', async () => {
      const result = await adapter.handleWebhook(
        createRawWebhook({ signature: 't=123,v1=invalid-signature' }),
      );

      expect(result).toMatchObject({
        acknowledged: false,
        action: 'error',
      });
      expect(result.message).toContain('signature');
    });
  });
});
