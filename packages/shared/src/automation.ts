import { z } from 'zod';

export const createAutomationSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  prompt: z.string().min(1),
  scheduleType: z.enum(['manual', 'hourly', 'daily', 'weekly', 'cron']),
  cronExpression: z.string().max(120).optional(),
  timezone: z.string().default('UTC'),
  enabled: z.boolean().default(true),
  selectedModel: z.string().optional(),
  selectedProvider: z.string().optional(),
  persona: z.string().optional(),
  notificationMode: z.enum(['none', 'in-app', 'email-mock', 'webhook']).default('none'),
  webhookUrl: z.string().url().optional(),
});

export const updateAutomationSchema = createAutomationSchema.partial();

export const automationResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  workspaceId: z.string().uuid().nullable(),
  title: z.string(),
  prompt: z.string(),
  scheduleType: z.string(),
  cronExpression: z.string().nullable(),
  timezone: z.string(),
  enabled: z.boolean(),
  selectedModel: z.string().nullable(),
  selectedProvider: z.string().nullable(),
  persona: z.string().nullable(),
  notificationMode: z.string(),
  webhookUrl: z.string().nullable(),
  lastRunAt: z.date().nullable(),
  nextRunAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const automationRunResponseSchema = z.object({
  id: z.string().uuid(),
  automationId: z.string().uuid(),
  userId: z.string().uuid(),
  taskId: z.string().uuid().nullable(),
  trigger: z.string(),
  status: z.string(),
  startedAt: z.date().nullable(),
  finishedAt: z.date().nullable(),
  durationMs: z.string().nullable(),
  error: z.string().nullable(),
  output: z.string().nullable(),
  createdAt: z.date(),
});
