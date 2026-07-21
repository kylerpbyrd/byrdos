import { pgTable, integer, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { accounts } from './account.schema.js';

export const balances = pgTable('balances', {
  id: text('id').primaryKey(), // UUID v7
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  current: integer('current').notNull(), // cents
  available: integer('available'),
  limit: integer('limit_amount'),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
// Append-only: new balances are new rows, current balance = latest row per account
