import {
  pgTable,
  boolean,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { accounts } from './account.schema';

export const transactions = pgTable(
  'transactions',
  {
    id: text('id').primaryKey(), // UUID v7
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    externalId: text('external_id').notNull(), // Plaid: transaction_id
    amountCents: integer('amount_cents').notNull(), // negative = debit
    date: varchar('date', { length: 10 }).notNull(), // YYYY-MM-DD
    authorizedDate: varchar('authorized_date', { length: 10 }),
    name: varchar('name', { length: 500 }).notNull(),
    merchantName: varchar('merchant_name', { length: 500 }),
    pending: boolean('pending').notNull().default(false),
    pendingTransactionExternalId: text('pending_transaction_external_id'),
    paymentChannel: varchar('payment_channel', { length: 50 }),
    isoCurrencyCode: varchar('iso_currency_code', { length: 3 }),
    categoryHash: text('category_hash'), // Normalized category key for lookup
    raw: jsonb('raw'), // Full provider payload for audit
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('transactions_account_external_id_idx').on(table.accountId, table.externalId),
  ],
);
