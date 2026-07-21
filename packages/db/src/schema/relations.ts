import { relations } from 'drizzle-orm';
import { users } from './user.schema.js';
import { sessions } from './session.schema.js';
import { integrations } from './integration.schema.js';
import { credentials } from './credential.schema.js';
import { providerConnections } from './provider-connection.schema.js';
import { accounts } from './account.schema.js';
import { balances } from './balance.schema.js';
import { transactions } from './transaction.schema.js';
import { categories } from './category.schema.js';
import { syncCursors } from './sync-cursor.schema.js';
import { syncJobs } from './sync-job.schema.js';
import { syncJobStages } from './sync-job-stage.schema.js';

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  integrations: many(integrations),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const integrationsRelations = relations(integrations, ({ one, many }) => ({
  user: one(users, { fields: [integrations.userId], references: [users.id] }),
  credential: one(credentials, {
    fields: [integrations.id],
    references: [credentials.integrationId],
  }),
  connections: many(providerConnections),
}));

export const credentialsRelations = relations(credentials, ({ one }) => ({
  integration: one(integrations, {
    fields: [credentials.integrationId],
    references: [integrations.id],
  }),
}));

export const providerConnectionsRelations = relations(providerConnections, ({ one, many }) => ({
  integration: one(integrations, {
    fields: [providerConnections.integrationId],
    references: [integrations.id],
  }),
  accounts: many(accounts),
  syncCursors: many(syncCursors),
  syncJobs: many(syncJobs),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  connection: one(providerConnections, {
    fields: [accounts.connectionId],
    references: [providerConnections.id],
  }),
  balances: many(balances),
  transactions: many(transactions),
}));

export const balancesRelations = relations(balances, ({ one }) => ({
  account: one(accounts, { fields: [balances.accountId], references: [accounts.id] }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  account: one(accounts, { fields: [transactions.accountId], references: [accounts.id] }),
}));

export const categoriesRelations = relations(categories, ({ one }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
}));

export const syncCursorsRelations = relations(syncCursors, ({ one }) => ({
  connection: one(providerConnections, {
    fields: [syncCursors.connectionId],
    references: [providerConnections.id],
  }),
}));

export const syncJobsRelations = relations(syncJobs, ({ one, many }) => ({
  connection: one(providerConnections, {
    fields: [syncJobs.connectionId],
    references: [providerConnections.id],
  }),
  stages: many(syncJobStages),
}));

export const syncJobStagesRelations = relations(syncJobStages, ({ one }) => ({
  job: one(syncJobs, { fields: [syncJobStages.jobId], references: [syncJobs.id] }),
}));
