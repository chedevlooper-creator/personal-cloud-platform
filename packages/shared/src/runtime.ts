import { z } from 'zod';

export const createRuntimeSchema = z.object({
  workspaceId: z.string().uuid(),
  image: z.string().default('node:18-alpine'),
  options: z.object({
    cpu: z.number().optional(),
    memory: z.number().optional(),
    env: z.record(z.string()).optional(),
  }).optional(),
});

export const execCommandSchema = z.object({
  command: z.array(z.string()),
});

export const runtimeResponseSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  image: z.string(),
  status: z.string(),
  createdAt: z.date(),
});
