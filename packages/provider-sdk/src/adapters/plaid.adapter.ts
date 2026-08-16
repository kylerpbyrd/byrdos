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
  type Transaction,
  type RemovedTransaction,
} from 'plaid';
import { importJWK, jwtVerify, decodeProtectedHeader, type JWK } from 'jose';
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
import { ProviderError } from '../errors.js';

type PlaidWebhookVerificationKey = JWK & { created_at?: number; expired_at?: number };

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
    if (config.environment === 'production' && process.env.PLAID_ALLOW_PRODUCTION !== 'true') {
      throw new Error(
        'PlaidAdapter refused to start in production. Production billing is only enabled by setting PLAID_ALLOW_PRODUCTION=true explicitly. Sandbox is always free.'
      );
    }
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

  async initiateRelink(connection: ProviderConnection): Promise<LinkToken> {
    const accessToken = (connection as { __accessToken?: string }).__accessToken;
    if (!accessToken) {
      throw new ProviderError('invalid_request', 'Missing access token for connection', { providerId: 'plaid' });
    }

    try {
      const request: LinkTokenCreateRequest = {
        user: { client_user_id: connection.id },
        client_name: 'byrdOS',
        products: [Products.Transactions, Products.Auth],
        country_codes: [CountryCode.Us],
        language: 'en',
        access_token: accessToken,
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

  async exchangePublicToken(payload: LinkCallback): Promise<ExchangeResult> {
    try {
      const request: ItemPublicTokenExchangeRequest = {
        public_token: payload.publicToken,
      };

      const response = await this.client.itemPublicTokenExchange(request);
      const accessToken = response.data.access_token;
      const itemId = response.data.item_id;
      const institutionName = payload.metadata?.institution?.name ?? null;

      const connection: ProviderConnection = {
        id: '', // Assigned by service layer after DB insert
        integrationId: '', // Assigned by service layer
        externalId: itemId,
        providerId: 'plaid',
        institutionName,
        status: 'active',
        lastWebhookAt: null,
        createdAt: new Date().toISOString(),
      };

      return { connection, accessToken };
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

  private mapTransaction(txn: Transaction): ProviderTransaction {
    return {
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

  async *listTransactions(
    connection: ProviderConnection,
    cursor: SyncCursor,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _range: DateRange,
  ): AsyncIterable<TransactionBatch> {
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

        const added = data.added.map((txn) => this.mapTransaction(txn));
        const modified = data.modified.map((txn) => this.mapTransaction(txn));
        const removed = data.removed.map((r: RemovedTransaction) => r.transaction_id);

        yield {
          added,
          modified,
          removed,
          nextCursor: data.next_cursor,
          hasMore: data.has_more,
        };

        hasMore = data.has_more;
        currentCursor = data.next_cursor;
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

  private readonly webhookKeyCache = new Map<string, { key: PlaidWebhookVerificationKey; expiredAt: number }>();

  async handleWebhook(event: RawWebhook): Promise<WebhookResult> {
    try {
      // Verify webhook signature
      await this.verifyWebhookSignature(event.payload, event.signature);

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

  private getPlaidBaseUrl(): string {
    switch (this.config.environment) {
      case 'production':
        return 'https://production.plaid.com';
      case 'development':
        return 'https://development.plaid.com';
      case 'sandbox':
      default:
        return 'https://sandbox.plaid.com';
    }
  }

  private async fetchWebhookVerificationKey(expectedKid: string): Promise<PlaidWebhookVerificationKey> {
    const response = await fetch(`${this.getPlaidBaseUrl()}/webhook_verification_key/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        secret: this.config.secret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Plaid webhook verification key: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      key?: PlaidWebhookVerificationKey;
      request_id?: string;
    };

    if (!data.key?.kid) {
      throw new Error('Plaid webhook verification key response missing key');
    }

    if (data.key.kid !== expectedKid) {
      throw new Error(`Plaid webhook verification key kid mismatch: expected ${expectedKid}, got ${data.key.kid}`);
    }

    return data.key;
  }

  private async verifyWebhookSignature(_payload: Record<string, unknown>, signatureHeader: string): Promise<void> {
    if (!signatureHeader) {
      throw new Error('Missing Plaid-Verification JWT header');
    }

    let header;
    try {
      header = decodeProtectedHeader(signatureHeader);
    } catch {
      throw new Error('Invalid Plaid-Verification JWT header');
    }

    const kid = header.kid;
    const headerAlg = header.alg;

    if (typeof kid !== 'string' || !kid) {
      throw new Error('Plaid-Verification JWT missing kid');
    }

    const now = Math.floor(Date.now() / 1000);
    const cached = this.webhookKeyCache.get(kid);
    let key: PlaidWebhookVerificationKey;

    if (!cached || now >= cached.expiredAt) {
      key = await this.fetchWebhookVerificationKey(kid);
      const expiredAt = Number(key.expired_at);
      if (!Number.isFinite(expiredAt)) {
        throw new Error('Plaid webhook verification key missing expired_at');
      }
      this.webhookKeyCache.set(kid, { key, expiredAt });
    } else {
      key = cached.key;
    }

    if (!key.alg) {
      throw new Error('Plaid webhook verification key missing alg');
    }

    if (headerAlg !== key.alg) {
      throw new Error(`Plaid-Verification JWT alg mismatch: expected ${key.alg}, got ${headerAlg}`);
    }

    const { payload } = await jwtVerify(signatureHeader, await importJWK(key), {
      algorithms: [key.alg],
    });

    const iat = Number(payload.iat);
    if (!Number.isFinite(iat) || iat < now - 300 || iat > now + 300) {
      throw new Error('Plaid-Verification JWT issued outside clock-skew window');
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
