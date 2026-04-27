import {
  pgTable,
  timestamp,
  uuid,
  varchar,
  text,
  jsonb,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { workspaces } from './workspaces';

export const snapshots = pgTable(
  'snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    storageKey: varchar('storage_key', { length: 1024 }).notNull(), // tar.gz key
    sizeBytes: varchar('size_bytes', { length: 32 }).default('0').notNull(),
    fileCount: integer('file_count').default(0).notNull(),
    kind: varchar('kind', { length: 16 }).default('manual').notNull(), // manual | auto-pre-restore
    status: varchar('status', { length: 16 }).default('creating').notNull(),
    // creating | ready | failed | restoring | deleted
    error: text('error'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => ({
    userIdx: index('snapshots_user_idx').on(t.userId, t.deletedAt),
    workspaceIdx: index('snapshots_workspace_idx').on(t.workspaceId, t.createdAt),
  }),
);
