import { pgTable, timestamp, uuid, varchar, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';
import { workspaces } from './workspaces';

export const runtimes = pgTable('runtimes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 50 }).default('docker').notNull(),
  containerId: varchar('container_id', { length: 255 }),
  image: varchar('image', { length: 255 }).notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, running, stopped, error
  options: jsonb('options'), // cpu, memory, env vars etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastStartedAt: timestamp('last_started_at'),
  lastStoppedAt: timestamp('last_stopped_at'),
});
