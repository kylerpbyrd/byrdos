import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(), // UUID v7
  actor: text('actor').notNull(), // userId or 'system'
  action: text('action').notNull(), // e.g. 'user.signup', 'session.create', 'token.refresh'
  target: text('target').notNull(), // resource id being acted upon
  meta: jsonb('meta'), // additional context (no secrets)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
