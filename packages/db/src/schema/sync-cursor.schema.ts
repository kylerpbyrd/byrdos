import { pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { providerConnections } from './provider-connection.schema.js';

export const syncCursors = pgTable(
  'sync_cursors',
  {
    id: text('id').primaryKey(), // UUID v7
    connectionId: text('connection_id')
      .notNull()
      .references(() => providerConnections.id, { onDelete: 'cascade' }),
    resourceType: varchar('resource_type', { length: 50 }).notNull(), // 'accounts' | 'transactions'
    cursor: text('cursor').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('sync_cursors_connection_resource_type_idx').on(
      table.connectionId,
      table.resourceType,
    ),
  ],
);
