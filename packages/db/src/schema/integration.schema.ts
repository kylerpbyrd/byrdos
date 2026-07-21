import { pgTable, text, timestamp, varchar, index } from 'drizzle-orm/pg-core';
import { users } from './user.schema.js';

export const integrations = pgTable(
  'integrations',
  {
    id: text('id').primaryKey(), // UUID v7
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    providerId: varchar('provider_id', { length: 50 }).notNull(), // 'plaid' | 'mx' | 'akoya' | 'varo-direct'
    status: varchar('status', { length: 20 }).notNull().default('active'), // 'active' | 'error' | 'revoked'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('integrations_user_id_idx').on(table.userId)],
);
