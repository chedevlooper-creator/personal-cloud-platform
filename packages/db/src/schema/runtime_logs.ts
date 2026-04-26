import { pgTable, timestamp, uuid, text, varchar } from 'drizzle-orm/pg-core';
import { runtimes } from './runtimes';

export const runtimeLogs = pgTable('runtime_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  runtimeId: uuid('runtime_id').notNull().references(() => runtimes.id, { onDelete: 'cascade' }),
  stream: varchar('stream', { length: 10 }).default('stdout').notNull(), // stdout, stderr
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
