import { pgTable, timestamp, uuid, varchar, text, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { tasks } from './tasks';

/**
 * Structured tool-call records. One row per tool invocation in an agent loop.
 * Distinct from task_steps (which is the human-readable execution log).
 */
export const toolCalls = pgTable(
  'tool_calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerCallId: varchar('provider_call_id', { length: 120 }), // LLM tool_call.id
    toolName: varchar('tool_name', { length: 64 }).notNull(),
    args: jsonb('args').$type<Record<string, unknown>>().notNull(),
    status: varchar('status', { length: 32 }).default('pending').notNull(),
    // pending | awaiting_approval | running | completed | failed | rejected | timeout
    result: text('result'),
    error: text('error'),
    approvalId: uuid('approval_id'),
    durationMs: varchar('duration_ms', { length: 16 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (t) => ({
    taskIdx: index('tool_calls_task_idx').on(t.taskId),
    userIdx: index('tool_calls_user_idx').on(t.userId, t.status),
  }),
);

export const approvalRequests = pgTable(
  'approval_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    toolCallId: uuid('tool_call_id')
      .notNull()
      .references(() => toolCalls.id, { onDelete: 'cascade' }),
    toolName: varchar('tool_name', { length: 64 }).notNull(),
    args: jsonb('args').$type<Record<string, unknown>>().notNull(),
    riskNote: text('risk_note'), // human-readable explanation
    decision: varchar('decision', { length: 16 }), // approve | reject | expired
    decisionReason: text('decision_reason'),
    requestedAt: timestamp('requested_at').defaultNow().notNull(),
    decidedAt: timestamp('decided_at'),
    expiresAt: timestamp('expires_at').notNull(),
  },
  (t) => ({
    userIdx: index('approval_requests_user_idx').on(t.userId, t.decision),
    taskIdx: index('approval_requests_task_idx').on(t.taskId),
  }),
);
