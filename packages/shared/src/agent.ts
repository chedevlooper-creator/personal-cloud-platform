import { z } from 'zod';

export const createTaskSchema = z.object({
  workspaceId: z.string().uuid(),
  input: z.string().min(1),
});

export const taskResponseSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
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
