import { pgTable, timestamp, uuid, varchar, jsonb } from 'drizzle-orm/pg-core';
import { runtimes } from './runtimes';

export const runtimeEvents = pgTable('runtime_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  runtimeId: uuid('runtime_id').notNull().references(() => runtimes.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(), // start, stop, exec, error, oom
  payload: jsonb('payload'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
