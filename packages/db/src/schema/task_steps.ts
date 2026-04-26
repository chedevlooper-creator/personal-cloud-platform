import { pgTable, timestamp, uuid, varchar, text, jsonb, integer } from 'drizzle-orm/pg-core';
import { tasks } from './tasks';

export const taskSteps = pgTable('task_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  stepNumber: integer('step_number').notNull(),
  type: varchar('type', { length: 50 }).notNull(), // thought, action, observation
  content: text('content'), // Reasoning or output
  toolName: varchar('tool_name', { length: 255 }), // If type === action
  toolInput: jsonb('tool_input'), // If type === action
  toolOutput: text('tool_output'), // If type === observation
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
