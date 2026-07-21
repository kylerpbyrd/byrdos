import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { integrations } from './integration.schema';

export const credentials = pgTable('credentials', {
  id: text('id').primaryKey(), // UUID v7
  integrationId: text('integration_id').notNull().unique().references(() => integrations.id, { onDelete: 'cascade' }),
  cipher: text('cipher').notNull(), // AES-256-GCM encrypted token (base64)
  keyId: text('key_id').notNull().default('v1'), // Encryption key identifier for rotation
  expiresAt: timestamp('expires_at', { withTimezone: true }), // null = no expiry (aggregator access tokens)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
