import { pgTable, timestamp, uuid, varchar, jsonb, bigint, integer, index } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Datasets are user-owned tabular files registered into a per-user DuckDB database.
 * Each row maps a logical dataset (e.g. "expenses") to a DuckDB table name and
 * remembers schema + provenance so the UI can preview without re-introspecting.
 */
export const datasets = pgTable(
  'datasets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    tableName: varchar('table_name', { length: 120 }).notNull(),
    sourceType: varchar('source_type', { length: 32 }).notNull(), // csv | json | parquet
    sourceFilename: varchar('source_filename', { length: 512 }),
    columns: jsonb('columns')
      .$type<Array<{ name: string; type: string }>>()
      .default([])
      .notNull(),
    rowCount: bigint('row_count', { mode: 'number' }).default(0).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).default(0).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => ({
    userIdx: index('datasets_user_idx').on(t.userId, t.deletedAt),
    userTableIdx: index('datasets_user_table_idx').on(t.userId, t.tableName),
  }),
);
