import { relations } from 'drizzle-orm';
import { users } from './user.schema';
import { sessions } from './session.schema';
import { integrations } from './integration.schema';
import { credentials } from './credential.schema';
import { providerConnections } from './provider-connection.schema';

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  integrations: many(integrations),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const integrationsRelations = relations(integrations, ({ one, many }) => ({
  user: one(users, { fields: [integrations.userId], references: [users.id] }),
  credential: one(credentials, { fields: [integrations.id], references: [credentials.integrationId] }),
  connections: many(providerConnections),
}));

export const credentialsRelations = relations(credentials, ({ one }) => ({
  integration: one(integrations, { fields: [credentials.integrationId], references: [integrations.id] }),
}));

export const providerConnectionsRelations = relations(providerConnections, ({ one }) => ({
  integration: one(integrations, { fields: [providerConnections.integrationId], references: [integrations.id] }),
}));
