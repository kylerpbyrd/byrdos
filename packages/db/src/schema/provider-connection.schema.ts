import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { integrations } from './integration.schema';

export const providerConnections = pgTable('provider_connections', {
  id: text('id').primaryKey(), // UUID v7
  integrationId: text('integration_id').notNull().references(() => integrations.id, { onDelete: 'cascade' }),
  externalId: text('external_id').notNull(), // Plaid: item_id, MX: member_guid
  institutionName: varchar('institution_name', { length: 255 }),
  status: varchar('status', { length: 20 }).notNull().default('active'), // 'active' | 'error' | 'pending_reconnect'
  lastWebhookAt: timestamp('last_webhook_at', { withTimezone: true }),
  webhookCursor: text('webhook_cursor'), // Last processed webhook cursor for idempotency
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
