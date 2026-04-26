import { pgTable, timestamp, uuid, varchar, text, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';
import { workspaces } from './workspaces';

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 50 }).default('pending').notNull(), // pending, planning, executing, waiting_approval, completed, failed, cancelled
  input: text('input').notNull(),
  output: text('output'),
  metadata: jsonb('metadata'), // provider, model, tokens used, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
