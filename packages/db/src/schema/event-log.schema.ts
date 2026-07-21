import { pgTable, text, timestamp, jsonb, integer, varchar, index } from 'drizzle-orm/pg-core';

export const eventLog = pgTable(
  'event_log',
  {
    id: text('id').primaryKey(), // UUID v7
    aggregateId: text('aggregate_id').notNull(), // e.g., connectionId or accountId
    aggregateType: varchar('aggregate_type', { length: 50 }).notNull(), // e.g., 'connection', 'account'
    eventType: varchar('event_type', { length: 100 }).notNull(), // e.g., 'AccountsSynced', 'TransactionsSynced'
    payload: jsonb('payload').notNull(), // the event data
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }), // null until processed by relay
    status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'processing' | 'delivered' | 'failed'
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'), // error message from last failed attempt
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('event_log_status_occurred_at_idx').on(table.status, table.occurredAt)],
);
