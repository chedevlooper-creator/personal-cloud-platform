import { pgTable, timestamp, uuid, varchar, text, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { workspaces } from './workspaces';

/**
 * A conversation groups multiple agent tasks under a single chat thread.
 * Tasks are linked via `tasks.conversationId` (added in this migration).
 */
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 200 }),
    provider: varchar('provider', { length: 32 }).default('mock').notNull(),
    model: varchar('model', { length: 120 }),
    personaId: uuid('persona_id'),
    systemInstructions: text('system_instructions'),
    channel: varchar('channel', { length: 32 }).default('web').notNull(), // web | telegram | email | discord
    channelThreadId: varchar('channel_thread_id', { length: 256 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    archivedAt: timestamp('archived_at'),
  },
  (t) => ({
    userIdx: index('conversations_user_idx').on(t.userId, t.archivedAt),
    workspaceIdx: index('conversations_workspace_idx').on(t.workspaceId),
  }),
);
