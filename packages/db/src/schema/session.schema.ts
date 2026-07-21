import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { users } from './user.schema';

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // UUID v7
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  refreshHash: text('refresh_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
