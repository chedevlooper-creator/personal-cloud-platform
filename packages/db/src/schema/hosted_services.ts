import {
  pgTable,
  timestamp,
  uuid,
  varchar,
  text,
  jsonb,
  boolean,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { workspaces } from './workspaces';

export const hostedServices = pgTable(
  'hosted_services',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    kind: varchar('kind', { length: 16 }).notNull(), // static | vite | node
    rootPath: varchar('root_path', { length: 1024 }).notNull(), // relative to workspace
    startCommand: varchar('start_command', { length: 500 }),
    port: integer('port'), // bound on runner; null until started
    envVars: jsonb('env_vars').$type<Record<string, string>>().default({}).notNull(),
    isPublic: boolean('is_public').default(false).notNull(),
    autoRestart: boolean('auto_restart').default(true).notNull(),
    customDomain: varchar('custom_domain', { length: 253 }),
    status: varchar('status', { length: 16 }).default('stopped').notNull(),
    // stopped | starting | running | crashed | stopping
    runnerProcessId: varchar('runner_process_id', { length: 64 }),
    publicUrl: varchar('public_url', { length: 1024 }),
    lastHealthAt: timestamp('last_health_at'),
    lastHealthOk: boolean('last_health_ok'),
    crashCount: integer('crash_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => ({
    userIdx: index('hosted_services_user_idx').on(t.userId, t.deletedAt),
    slugIdx: index('hosted_services_slug_idx').on(t.userId, t.slug),
  }),
);

export const hostedServiceLogs = pgTable(
  'hosted_service_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => hostedServices.id, { onDelete: 'cascade' }),
    stream: varchar('stream', { length: 8 }).notNull(), // stdout | stderr | system
    line: text('line').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    serviceIdx: index('hosted_service_logs_service_idx').on(t.serviceId, t.createdAt),
  }),
);
