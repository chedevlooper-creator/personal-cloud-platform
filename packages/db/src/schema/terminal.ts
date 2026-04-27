import {
  pgTable,
  timestamp,
  uuid,
  varchar,
  text,
  jsonb,
  integer,
  index,
  boolean,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { workspaces } from './workspaces';

export const terminalSessions = pgTable(
  'terminal_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 80 }),
    cwd: varchar('cwd', { length: 1024 }).default('/').notNull(),
    cols: integer('cols').default(120).notNull(),
    rows: integer('rows').default(30).notNull(),
    status: varchar('status', { length: 16 }).default('active').notNull(), // active | closed
    runnerProcessId: varchar('runner_process_id', { length: 64 }),
    lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    closedAt: timestamp('closed_at'),
  },
  (t) => ({
    userIdx: index('terminal_sessions_user_idx').on(t.userId, t.status),
  }),
);

export const terminalCommands = pgTable(
  'terminal_commands',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => terminalSessions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    command: text('command').notNull(),
    cwd: varchar('cwd', { length: 1024 }).notNull(),
    policy: varchar('policy', { length: 16 }).notNull(), // safe | needs_approval | blocked
    approvalId: uuid('approval_id'),
    blocked: boolean('blocked').default(false).notNull(),
    exitCode: integer('exit_code'),
    durationMs: integer('duration_ms'),
    truncatedOutput: text('truncated_output'),
    startedAt: timestamp('started_at'),
    finishedAt: timestamp('finished_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (t) => ({
    sessionIdx: index('terminal_commands_session_idx').on(t.sessionId, t.createdAt),
    userIdx: index('terminal_commands_user_idx').on(t.userId, t.createdAt),
  }),
);
