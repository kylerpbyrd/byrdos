import { pgTable, integer, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { providerConnections } from './provider-connection.schema';

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(), // UUID v7
    connectionId: text('connection_id')
      .notNull()
      .references(() => providerConnections.id, { onDelete: 'cascade' }),
    externalId: text('external_id').notNull(), // Plaid: account_id
    mask: varchar('mask', { length: 50 }),
    name: varchar('name', { length: 255 }).notNull(),
    officialName: varchar('official_name', { length: 255 }),
    type: varchar('type', { length: 50 }).notNull(), // depository, credit, loan, investment
    subtype: varchar('subtype', { length: 50 }), // checking, savings, credit card, etc.
    currentBalanceCents: integer('current_balance_cents').notNull().default(0), // cached for fast reads
    availableBalanceCents: integer('available_balance_cents'),
    balanceLimitCents: integer('balance_limit_cents'),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    status: varchar('status', { length: 20 }).notNull().default('active'), // 'active' | 'closed'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('accounts_connection_external_id_idx').on(table.connectionId, table.externalId),
  ],
);
