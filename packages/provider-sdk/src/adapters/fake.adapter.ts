import type { IProviderAdapter } from '../adapter.interface.js';
import type {
  ProviderId,
  LinkToken,
  LinkCallback,
  ProviderConnection,
  ExchangeResult,
  ProviderAccount,
  ProviderBalance,
  ProviderTransaction,
  TransactionBatch,
  SyncCursor,
  DateRange,
  RawWebhook,
  WebhookResult,
} from '@byrdos/contracts';

const FAKE_ACCESS_TOKEN = 'fake-access-token';
const FAKE_ITEM_ID = 'fake-item-1';
const FAKE_INSTITUTION_NAME = 'Fake Bank';
const FAKE_ACCOUNT_CHECKING: ProviderAccount = {
  externalId: 'fake-acc-checking',
  mask: '0001',
  name: 'Fake Checking',
  officialName: 'Fake Bank Checking Account',
  type: 'depository',
  subtype: 'checking',
  balanceAvailable: 100000,
  balanceCurrent: 100000,
  balanceLimit: null,
  currency: 'USD',
};
const FAKE_ACCOUNT_CREDIT: ProviderAccount = {
  externalId: 'fake-acc-credit',
  mask: '0002',
  name: 'Fake Credit Card',
  officialName: 'Fake Bank Rewards Card',
  type: 'credit',
  subtype: 'credit card',
  balanceAvailable: 450000,
  balanceCurrent: 500000,
  balanceLimit: 500000,
  currency: 'USD',
};
const FAKE_ACCOUNTS: ProviderAccount[] = [FAKE_ACCOUNT_CHECKING, FAKE_ACCOUNT_CREDIT];

/**
 * Deterministic, network-free test double for IProviderAdapter.
 * Reports providerId as 'plaid' so it can be resolved through
 * ProviderRegistry.get('plaid') in test/CI environments.
 */
export class FakeProviderAdapter implements IProviderAdapter {
  readonly providerId: ProviderId = 'plaid';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async initiateLink(_userId: string, _returnUri: string): Promise<LinkToken> {
    return {
      token: 'fake-link-token',
      expiration: '2099-12-31T23:59:59Z',
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async initiateRelink(_connection: ProviderConnection): Promise<LinkToken> {
    return {
      token: 'fake-relink-token',
      expiration: '2099-12-31T23:59:59Z',
    };
  }

  async exchangePublicToken(_payload: LinkCallback): Promise<ExchangeResult> {
    const connection: ProviderConnection = {
      id: '',
      integrationId: '',
      externalId: FAKE_ITEM_ID,
      providerId: 'plaid',
      institutionName: FAKE_INSTITUTION_NAME,
      status: 'active',
      lastWebhookAt: null,
      createdAt: new Date().toISOString(),
    };

    return { connection, accessToken: FAKE_ACCESS_TOKEN };
  }

  async refreshCredentials(connection: ProviderConnection): Promise<ProviderConnection> {
    return connection;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async listAccounts(_connection: ProviderConnection): Promise<ProviderAccount[]> {
    return FAKE_ACCOUNTS.map((account) => ({ ...account }));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getBalances(
    _connection: ProviderConnection,
    accountExternalIds?: string[],
  ): Promise<ProviderBalance[]> {
    const now = new Date().toISOString();
    return FAKE_ACCOUNTS
      .filter((account) => !accountExternalIds || accountExternalIds.includes(account.externalId))
      .map((account) => ({
        accountExternalId: account.externalId,
        available: account.balanceAvailable,
        current: account.balanceCurrent,
        limit: account.balanceLimit,
        currency: account.currency,
        recordedAt: now,
      }));
  }

  async *listTransactions(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _connection: ProviderConnection,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _cursor: SyncCursor,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _range: DateRange,
  ): AsyncIterable<TransactionBatch> {
    const added: ProviderTransaction[] = [
      {
        externalId: 'tx-1',
        accountExternalId: FAKE_ACCOUNT_CHECKING.externalId,
        amount: -2500,
        date: '2026-01-01',
        authorizedDate: '2026-01-01',
        name: 'Fake Grocery Store',
        merchantName: 'Fake Grocery Store',
        pending: false,
        pendingTransactionExternalId: null,
        category: ['Food and Drink', 'Groceries'],
        paymentChannel: 'in store',
        isoCurrencyCode: 'USD',
        raw: null,
      },
      {
        externalId: 'tx-2',
        accountExternalId: FAKE_ACCOUNT_CREDIT.externalId,
        amount: 9999,
        date: '2026-01-02',
        authorizedDate: '2026-01-02',
        name: 'Fake Employer',
        merchantName: 'Fake Employer',
        pending: false,
        pendingTransactionExternalId: null,
        category: ['Transfer', 'Payroll'],
        paymentChannel: 'other',
        isoCurrencyCode: 'USD',
        raw: null,
      },
    ];

    yield {
      added,
      modified: [],
      removed: [],
      nextCursor: 'fake-cursor',
      hasMore: false,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async revoke(_connection: ProviderConnection): Promise<void> {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async handleWebhook(_event: RawWebhook): Promise<WebhookResult> {
    return { acknowledged: true, action: 'ignored', message: 'fake' };
  }
}
