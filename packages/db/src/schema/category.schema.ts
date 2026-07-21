import { pgTable, text, timestamp, varchar, index } from 'drizzle-orm/pg-core';
import { users } from './user.schema.js';

export const categories = pgTable(
  'categories',
  {
    id: text('id').primaryKey(), // UUID v7
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }), // null = system default
    name: varchar('name', { length: 255 }).notNull(),
    normName: varchar('norm_name', { length: 255 }).notNull(), // lowercase, trimmed, for matching
    kind: varchar('kind', { length: 20 }).notNull().default('expense'), // 'income' | 'expense' | 'transfer'
    parentId: text('parent_id'), // self-referencing for hierarchy
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('categories_user_id_idx').on(table.userId),
    index('categories_parent_id_idx').on(table.parentId),
  ],
);
