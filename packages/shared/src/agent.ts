import { z } from 'zod';

export const createTaskSchema = z.object({
  workspaceId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  input: z.string().min(1),
  personaId: z.string().uuid().nullable().optional(),
  skillIds: z.array(z.string().uuid()).max(5).optional(),
});

export const taskResponseSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  conversationId: z.string().uuid().nullable().optional(),
  status: z.string(),
  input: z.string(),
  output: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const taskStepSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  stepNumber: z.number(),
  type: z.string(),
  content: z.string().nullable(),
  toolName: z.string().nullable(),
  toolInput: z.any().nullable(),
  toolOutput: z.string().nullable(),
  createdAt: z.date(),
});

export const toolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.any()),
});

export const conversationResponseSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid().nullable(),
  title: z.string().nullable(),
  provider: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const messageResponseSchema = z.object({
  id: z.string(),
  taskId: z.string().uuid(),
  taskStatus: z.string(),
  conversationId: z.string().uuid(),
  role: z.string(),
  content: z.string(),
  toolCalls: z.array(z.any()).optional(),
  createdAt: z.date(),
});

export const toolApprovalSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: z.string().optional(),
});

export const taskEventStreamQuerySchema = z.object({
  snapshot: z.coerce.boolean().optional(),
});
