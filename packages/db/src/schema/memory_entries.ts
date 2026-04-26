import { pgTable, timestamp, uuid, varchar, text, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';
import { workspaces } from './workspaces';

// Reverting to basic custom approach since Drizzle's vector API is still experimental
import { customType } from 'drizzle-orm/pg-core';

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return value.replace('[', '').replace(']', '').split(',').map(Number);
  },
});

export const memoryEntries = pgTable('memory_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(), // short-term, long-term, episodic
  content: text('content').notNull(),
  embedding: vector('embedding'), // text-embedding-3-small dimension
  metadata: jsonb('metadata'), // e.g. source, task_id, tokens
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
