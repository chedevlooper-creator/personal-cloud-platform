import {
  pgTable,
  timestamp,
  uuid,
  varchar,
  text,
  jsonb,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { workspaces } from './workspaces';

export const automations = pgTable(
  'automations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 200 }).notNull(),
    prompt: text('prompt').notNull(),
    scheduleType: varchar('schedule_type', { length: 16 }).default('manual').notNull(),
    // manual | hourly | daily | weekly | cron
    cronExpression: varchar('cron_expression', { length: 120 }),
    timezone: varchar('timezone', { length: 64 }).default('UTC').notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    selectedModel: varchar('selected_model', { length: 120 }),
    selectedProvider: varchar('selected_provider', { length: 32 }),
    persona: text('persona'),
    notificationMode: varchar('notification_mode', { length: 16 }).default('none').notNull(),
    // none | in-app | email-mock | webhook
    webhookUrl: varchar('webhook_url', { length: 2048 }),
    lastRunAt: timestamp('last_run_at'),
    nextRunAt: timestamp('next_run_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => ({
    userIdx: index('automations_user_idx').on(t.userId, t.deletedAt),
    nextRunIdx: index('automations_next_run_idx').on(t.enabled, t.nextRunAt),
  }),
);

export const automationRuns = pgTable(
  'automation_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    automationId: uuid('automation_id')
      .notNull()
      .references(() => automations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id'), // links to tasks.id created for this run
    trigger: varchar('trigger', { length: 16 }).default('manual').notNull(), // manual | schedule | tool | webhook
    status: varchar('status', { length: 16 }).default('queued').notNull(),
    // queued | running | completed | failed | cancelled
    startedAt: timestamp('started_at'),
    finishedAt: timestamp('finished_at'),
    durationMs: varchar('duration_ms', { length: 16 }),
    error: text('error'),
    output: text('output'),
    notificationSent: boolean('notification_sent').default(false).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    automationIdx: index('automation_runs_automation_idx').on(t.automationId, t.createdAt),
    userIdx: index('automation_runs_user_idx').on(t.userId, t.status),
  }),
);
