import { relations } from 'drizzle-orm';
import { users } from './user.schema';
import { sessions } from './session.schema';

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));
