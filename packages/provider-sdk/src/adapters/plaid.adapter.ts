import * as crypto from 'crypto';
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
  type LinkTokenCreateRequest,
  type ItemPublicTokenExchangeRequest,
  type AccountsGetRequest,
  type TransactionsSyncRequest,
} from 'plaid';
import type { IProviderAdapter } from '../adapter.interface';
import type {
  ProviderId,
  LinkToken,
  LinkCallback,
  ProviderConnection,
  ProviderAccount,
  ProviderBalance,
  ProviderTransaction,
  SyncCursor,
  DateRange,
  RawWebhook,
  WebhookResult,
} from '@byrdos/contracts';
import { ProviderError } from '../errors';

export interface PlaidAdapterConfig {
  clientId: string;
  secret: string;
  environment: 'sandbox' | 'development' | 'production';
  webhookVerificationKey: string;
}

export class PlaidAdapter implements IProviderAdapter {
  readonly providerId: ProviderId = 'plaid';
  private readonly client: PlaidApi;
  private readonly config: PlaidAdapterConfig;

  constructor(config: PlaidAdapterConfig) {
    this.config = config;
    const plaidEnv =
      config.environment === 'production'
        ? PlaidEnvironments.production
        : config.environment === 'development'
          ? PlaidEnvironments.development
          : PlaidEnvironments.sandbox;

    const plaidConfig = new Configuration({
      basePath: plaidEnv,
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': config.clientId,
          'PLAID-SECRET': config.secret,
          'Plaid-Version': '2020-09-14',
        },
      },
    });
    this.client = new PlaidApi(plaidConfig);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async initiateLink(userId: string, _returnUri: string): Promise<LinkToken> {
    try {
      const request: LinkTokenCreateRequest = {
        user: { client_user_id: userId },
        client_name: 'byrdOS',
        products: [Products.Transactions, Products.Auth],
        country_codes: [CountryCode.Us],
        language: 'en',
      };

      const response = await this.client.linkTokenCreate(request);
      return {
        token: response.data.link_token,
        expiration: response.data.expiration,
      };
    } catch (error: unknown) {
      throw this.mapError(error);
    }
  }

  async exchangePublicToken(payload: LinkCallback): Promise<ProviderConnection> {
    try {
      const request: ItemPublicTokenExchangeRequest = {
        public_token: payload.publicToken,
      };

      const response = await this.client.itemPublicTokenExchange(request);
      const itemId = response.data.item_id;
      const institutionName = payload.metadata?.institution?.name ?? null;

      return {
        id: '', // Assigned by service layer after DB insert
        integrationId: '', // Assigned by service layer
        externalId: itemId,
        providerId: 'plaid',
        institutionName,
        status: 'active',
        lastWebhookAt: null,
        createdAt: new Date().toISOString(),
      };
    } catch (error: unknown) {
      throw this.mapError(error);
    }
  }

  async refreshCredentials(connection: ProviderConnection): Promise<ProviderConnection> {
    // Plaid access tokens don't expire; nothing to refresh
    return connection;
  }

  async listAccounts(connection: ProviderConnection): Promise<ProviderAccount[]> {
    try {
      // The access token is stored encrypted; the service layer decrypts and passes it.
      // For this adapter, we assume the connection object carries the decrypted access token
      // in a way the adapter can use. In practice, the service layer will inject it.
      const accessToken = (connection as { __accessToken?: string }).__accessToken;
      if (!accessToken) {
        throw new ProviderError('invalid_request', 'Missing access token for connection', { providerId: 'plaid' });
      }

      const request: AccountsGetRequest = {
        access_token: accessToken,
      };

      const response = await this.client.accountsGet(request);
      const accounts: ProviderAccount[] = [];

      for (const acct of response.data.accounts) {
        accounts.push({
          externalId: acct.account_id,
          mask: acct.mask ?? null,
          name: acct.name,
          officialName: acct.official_name ?? null,
          type: acct.type,
          subtype: acct.subtype ?? null,
          balanceAvailable: acct.balances.available !== null ? Math.round(acct.balances.available * 100) : null,
          balanceCurrent: Math.round((acct.balances.current ?? 0) * 100),
          balanceLimit: acct.balances.limit !== null ? Math.round(acct.balances.limit * 100) : null,
          currency: acct.balances.iso_currency_code ?? 'USD',
        });
      }

      return accounts;
    } catch (error: unknown) {
      throw this.mapError(error);
    }
  }

  async getBalances(connection: ProviderConnection, accountExternalIds?: string[]): Promise<ProviderBalance[]> {
    try {
      const accessToken = (connection as { __accessToken?: string }).__accessToken;
      if (!accessToken) {
        throw new ProviderError('invalid_request', 'Missing access token for connection', { providerId: 'plaid' });
      }

      const request: AccountsGetRequest = {
        access_token: accessToken,
      };

      const response = await this.client.accountsGet(request);
      const balances: ProviderBalance[] = [];

      for (const acct of response.data.accounts) {
        if (accountExternalIds && !accountExternalIds.includes(acct.account_id)) continue;
        balances.push({
          accountExternalId: acct.account_id,
          available: acct.balances.available !== null ? Math.round(acct.balances.available * 100) : null,
          current: Math.round((acct.balances.current ?? 0) * 100),
          limit: acct.balances.limit !== null ? Math.round(acct.balances.limit * 100) : null,
          currency: acct.balances.iso_currency_code ?? 'USD',
          recordedAt: new Date().toISOString(),
        });
      }

      return balances;
    } catch (error: unknown) {
      throw this.mapError(error);
    }
  }

  async *listTransactions(
    connection: ProviderConnection,
    cursor: SyncCursor,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _range: DateRange,
  ): AsyncIterable<ProviderTransaction> {
    try {
      const accessToken = (connection as { __accessToken?: string }).__accessToken;
      if (!accessToken) {
        throw new ProviderError('invalid_request', 'Missing access token for connection', { providerId: 'plaid' });
      }

      let hasMore = true;
      let currentCursor = cursor.cursor || undefined;

      while (hasMore) {
        const request: TransactionsSyncRequest = {
          access_token: accessToken,
          cursor: currentCursor,
        };

        const response = await this.client.transactionsSync(request);
        const data = response.data;

        for (const txn of data.added) {
          yield {
            externalId: txn.transaction_id,
            accountExternalId: txn.account_id,
            amount: Math.round(txn.amount * 100), // Plaid returns dollars; convert to cents. Negative = debit
            date: txn.date,
            authorizedDate: txn.authorized_date ?? null,
            name: txn.name,
            merchantName: txn.merchant_name ?? null,
            pending: txn.pending,
            pendingTransactionExternalId: txn.pending_transaction_id ?? null,
            category: txn.category ?? null,
            paymentChannel: txn.payment_channel ?? null,
            isoCurrencyCode: txn.iso_currency_code ?? null,
            raw: txn as unknown as Record<string, unknown>,
          };
        }

        hasMore = data.has_more;
        currentCursor = data.next_cursor;

        // Update the cursor for the next iteration
        cursor = {
          resourceType: cursor.resourceType,
          cursor: data.next_cursor,
          updatedAt: new Date().toISOString(),
        };
      }
    } catch (error: unknown) {
      throw this.mapError(error);
    }
  }

  async revoke(connection: ProviderConnection): Promise<void> {
    try {
      const accessToken = (connection as { __accessToken?: string }).__accessToken;
      if (!accessToken) {
        throw new ProviderError('invalid_request', 'Missing access token for connection', { providerId: 'plaid' });
      }

      await this.client.itemRemove({ access_token: accessToken });
    } catch (error: unknown) {
      throw this.mapError(error);
    }
  }

  async handleWebhook(event: RawWebhook): Promise<WebhookResult> {
    try {
      // Verify webhook signature
      this.verifyWebhookSignature(event.payload, event.signature);

      const code = event.webhookCode;

      switch (code) {
        case 'SYNC_UPDATES_AVAILABLE':
          return { acknowledged: true, action: 'sync_triggered', message: 'New transactions available' };
        case 'DEFAULT_UPDATE':
          return { acknowledged: true, action: 'sync_triggered', message: 'Account data updated' };
        case 'INITIAL_UPDATE':
          return { acknowledged: true, action: 'sync_triggered', message: 'Initial sync complete' };
        case 'TRANSACTIONS_REMOVED':
          return { acknowledged: true, action: 'sync_triggered', message: 'Transactions removed' };
        case 'ITEM_LOGIN_REQUIRED':
        case 'LOGIN_REQUIRED':
          return { acknowledged: true, action: 'reauth_required', message: 'User needs to re-authenticate' };
        case 'ERROR':
          return { acknowledged: true, action: 'error', message: 'Plaid reported an error with this item' };
        case 'PENDING_EXPIRATION':
          return { acknowledged: true, action: 'ignored', message: 'Consent expiring soon' };
        default:
          return { acknowledged: true, action: 'ignored', message: `Unhandled webhook code: ${code}` };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Webhook handling failed';
      return { acknowledged: false, action: 'error', message };
    }
  }

  private verifyWebhookSignature(payload: Record<string, unknown>, signatureHeader: string): void {
    const key = this.config.webhookVerificationKey;

    // Plaid sends: t=timestamp,v1=signature
    // Simplified verification for M2; full verification in M6 security review
    const signed = crypto.createHmac('sha256', key).update(JSON.stringify(payload)).digest('hex');

    // The v1 signature is the last part after the comma
    const parts = signatureHeader.split(',');
    const v1Sig = parts.find((p: string) => p.startsWith('v1='));
    if (!v1Sig) {
      throw new Error('Missing v1 signature in webhook header');
    }

    const expectedSig = v1Sig.substring(3); // Remove 'v1='
    if (signed !== expectedSig) {
      throw new Error('Webhook signature verification failed');
    }
  }

  private mapError(error: unknown): Error {
    if (
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof (error as { response?: { data?: unknown } }).response?.data === 'object' &&
      (error as { response?: { data?: unknown } }).response?.data !== null
    ) {
      const plaidError = (error as { response: { data: Record<string, unknown> } }).response.data;
      const errorType = String(plaidError.error_type);
      const errorCode = plaidError.error_code !== undefined ? String(plaidError.error_code) : undefined;
      const errorMessage = plaidError.error_message !== undefined ? String(plaidError.error_message) : 'Unknown Plaid error';

      // Map to our ProviderError taxonomy (ADR-0009)
      if (errorType === 'ITEM_ERROR' && errorCode === 'ITEM_LOGIN_REQUIRED') {
        return new ProviderError('reauth_required', errorMessage, { providerId: 'plaid', errorCode });
      }
      if (errorType === 'RATE_LIMIT_EXCEEDED' || errorType === 'API_ERROR') {
        return new ProviderError('provider_unreachable', errorMessage, { providerId: 'plaid', errorCode, retryable: true });
      }
      if (errorType === 'INVALID_INPUT' || errorType === 'INVALID_REQUEST') {
        return new ProviderError('invalid_request', errorMessage, { providerId: 'plaid', errorCode });
      }
      return new ProviderError('provider_error', errorMessage, { providerId: 'plaid', errorCode });
    }

    const message = error instanceof Error ? error.message : 'Unknown Plaid error';
    return new ProviderError('provider_error', message, { providerId: 'plaid' });
  }
}
