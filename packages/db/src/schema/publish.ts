import { pgTable, varchar, timestamp, uuid, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users';
import { workspaces } from './workspaces';

export const appStatusEnum = pgEnum('app_status', ['active', 'inactive', 'suspended']);
export const deploymentStatusEnum = pgEnum('deployment_status', ['pending', 'building', 'running', 'failed', 'stopped']);

export const publishedApps = pgTable('published_apps', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  subdomain: varchar('subdomain', { length: 255 }).notNull().unique(),
  status: appStatusEnum('status').default('active').notNull(),
  config: jsonb('config').default({}).notNull(), // build configs, env vars, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const appDeployments = pgTable('app_deployments', {
  id: uuid('id').defaultRandom().primaryKey(),
  appId: uuid('app_id').notNull().references(() => publishedApps.id, { onDelete: 'cascade' }),
  version: varchar('version', { length: 50 }).notNull(),
  status: deploymentStatusEnum('status').default('pending').notNull(),
  containerId: varchar('container_id', { length: 255 }),
  logs: jsonb('logs'), // Optional structured logs or log reference
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
