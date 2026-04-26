import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';

export const workspaceFiles = pgTable('workspace_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  path: varchar('path', { length: 1024 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 255 }),
  size: varchar('size', { length: 20 }).default('0').notNull(),
  storageKey: varchar('storage_key', { length: 512 }),
  isDirectory: varchar('is_directory', { length: 1 }).default('0').notNull(),
  parentPath: varchar('parent_path', { length: 1024 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});