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

/**
 * Provider-agnostic adapter interface.
 * Every concrete provider (Plaid, MX, Akoya, Varo Direct) implements this.
 * No provider-specific types or concepts cross this boundary.
 */
export interface IProviderAdapter {
  /** Unique provider identifier */
  readonly providerId: ProviderId;

  /** Initiate a bank linking session. Returns a token for the frontend Link SDK. */
  initiateLink(userId: string, returnUri: string): Promise<LinkToken>;

  /** Exchange a public token (from frontend Link completion) for a permanent connection. */
  exchangePublicToken(payload: LinkCallback): Promise<ProviderConnection>;

  /** Refresh credentials if they've expired (for OAuth-based providers). */
  refreshCredentials(connection: ProviderConnection): Promise<ProviderConnection>;

  /** List all accounts for a connection, with current balances. */
  listAccounts(connection: ProviderConnection): Promise<ProviderAccount[]>;

  /** Get latest balances for specific accounts (lightweight, no full account sync). */
  getBalances(
    connection: ProviderConnection,
    accountExternalIds?: string[],
  ): Promise<ProviderBalance[]>;

  /** Stream transactions paginated via cursor. Returns an async iterable. */
  listTransactions(
    connection: ProviderConnection,
    cursor: SyncCursor,
    range: DateRange,
  ): AsyncIterable<ProviderTransaction>;

  /** Revoke a connection (permanently remove provider access). */
  revoke(connection: ProviderConnection): Promise<void>;

  /** Process an inbound webhook event from the provider. */
  handleWebhook(event: RawWebhook): Promise<WebhookResult>;
}
