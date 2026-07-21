import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { providerConnections } from './provider-connection.schema';

export const syncJobs = pgTable('sync_jobs', {
  id: text('id').primaryKey(), // UUID v7
  connectionId: text('connection_id')
    .notNull()
    .references(() => providerConnections.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(), // 'initial' | 'incremental' | 'on_demand' | 'backfill'
  status: varchar('status', { length: 20 }).notNull().default('queued'), // 'queued' | 'running' | 'accounts_done' | 'tx_done' | 'completed' | 'failed' | 'partial'
  trigger: varchar('trigger', { length: 20 }).notNull(), // 'initial' | 'incremental' | 'on_demand' | 'backfill' | 'webhook'
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
