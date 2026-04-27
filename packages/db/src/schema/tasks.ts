import { pgTable, timestamp, uuid, varchar, text, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { workspaces } from './workspaces';

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id'), // FK enforced application-side to avoid circular import
    status: varchar('status', { length: 50 }).default('pending').notNull(), // pending, planning, executing, waiting_approval, completed, failed, cancelled
    input: text('input').notNull(),
    output: text('output'),
    metadata: jsonb('metadata'), // provider, model, tokens used, etc.
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('tasks_user_idx').on(t.userId, t.status),
    conversationIdx: index('tasks_conversation_idx').on(t.conversationId),
  }),
);
