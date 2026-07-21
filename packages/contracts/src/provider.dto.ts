import { z } from 'zod';

// ── Provider Identity ──
export const ProviderId = z.enum(['plaid', 'mx', 'akoya', 'varo-direct']);
export type ProviderId = z.infer<typeof ProviderId>;

// ── Link Flow ──
export const LinkTokenSchema = z.object({
  token: z.string(),
  expiration: z.string().datetime(),
});
export type LinkToken = z.infer<typeof LinkTokenSchema>;

export const LinkCallbackSchema = z.object({
  publicToken: z.string(),
  metadata: z.object({
    institution: z
      .object({
        name: z.string(),
        institution_id: z.string(),
      })
      .optional(),
    accounts: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          mask: z.string().optional(),
          type: z.string(),
          subtype: z.string().optional(),
        }),
      )
      .optional(),
  }).optional(),
});
export type LinkCallback = z.infer<typeof LinkCallbackSchema>;

// ── Provider Connection ──
export const ProviderConnectionSchema = z.object({
  id: z.string(),
  integrationId: z.string(),
  externalId: z.string(), // Plaid: item_id
  providerId: ProviderId,
  institutionName: z.string().nullable(),
  status: z.enum(['active', 'error', 'pending_reconnect']),
  lastWebhookAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type ProviderConnection = z.infer<typeof ProviderConnectionSchema>;

// ── Accounts ──
export const ProviderAccountSchema = z.object({
  externalId: z.string(), // Plaid: account_id
  mask: z.string().nullable(),
  name: z.string(),
  officialName: z.string().nullable(),
  type: z.string(), // depository, credit, loan, investment
  subtype: z.string().nullable(), // checking, savings, credit card, etc.
  balanceAvailable: z.number().int().nullable(), // cents
  balanceCurrent: z.number().int(), // cents
  balanceLimit: z.number().int().nullable(),
  currency: z.string().default('USD'),
});
export type ProviderAccount = z.infer<typeof ProviderAccountSchema>;

// ── Balances ──
export const ProviderBalanceSchema = z.object({
  accountExternalId: z.string(),
  available: z.number().int().nullable(),
  current: z.number().int(),
  limit: z.number().int().nullable(),
  currency: z.string().default('USD'),
  recordedAt: z.string().datetime(),
});
export type ProviderBalance = z.infer<typeof ProviderBalanceSchema>;

// ── Transactions ──
export const ProviderTransactionSchema = z.object({
  externalId: z.string(), // Plaid: transaction_id
  accountExternalId: z.string(),
  amount: z.number().int(), // cents (negative for debits)
  date: z.string(), // YYYY-MM-DD
  authorizedDate: z.string().nullable(),
  name: z.string(),
  merchantName: z.string().nullable(),
  pending: z.boolean().default(false),
  pendingTransactionExternalId: z.string().nullable(),
  category: z.array(z.string()).nullable(),
  paymentChannel: z.string().nullable(),
  isoCurrencyCode: z.string().nullable(),
  raw: z.record(z.unknown()).nullable(), // full provider payload
});
export type ProviderTransaction = z.infer<typeof ProviderTransactionSchema>;

// ── Sync ──
export const SyncCursorSchema = z.object({
  resourceType: z.enum(['accounts', 'transactions']),
  cursor: z.string(),
  updatedAt: z.string().datetime(),
});
export type SyncCursor = z.infer<typeof SyncCursorSchema>;

export const DateRangeSchema = z.object({
  start: z.string(), // YYYY-MM-DD
  end: z.string(), // YYYY-MM-DD
});
export type DateRange = z.infer<typeof DateRangeSchema>;

// ── Webhooks ──
export const RawWebhookSchema = z.object({
  providerId: ProviderId,
  payload: z.record(z.unknown()),
  signature: z.string(),
  webhookType: z.string(), // e.g., TRANSACTIONS, ITEM, TRANSFER
  webhookCode: z.string(), // e.g., SYNC_UPDATES_AVAILABLE, LOGIN_REQUIRED
});
export type RawWebhook = z.infer<typeof RawWebhookSchema>;

export const WebhookResultSchema = z.object({
  acknowledged: z.boolean(),
  action: z.enum(['sync_triggered', 'reauth_required', 'ignored', 'error']),
  message: z.string().optional(),
});
export type WebhookResult = z.infer<typeof WebhookResultSchema>;
