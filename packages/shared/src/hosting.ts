import { z } from 'zod';

export const createHostedServiceSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(120),
  kind: z.enum(['static', 'vite', 'node']),
  rootPath: z.string().min(1).max(1024),
  startCommand: z.string().max(500).optional(),
  envVars: z.record(z.string()).default({}),
  isPublic: z.boolean().default(false),
  autoRestart: z.boolean().default(true),
  customDomain: z.string().max(253).optional(),
});

export const updateHostedServiceSchema = createHostedServiceSchema.partial();

export const hostedServiceResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  kind: z.string(),
  rootPath: z.string(),
  startCommand: z.string().nullable(),
  port: z.number().nullable(),
  envVars: z.record(z.string()),
  isPublic: z.boolean(),
  autoRestart: z.boolean(),
  customDomain: z.string().nullable(),
  status: z.string(),
  runnerProcessId: z.string().nullable(),
  publicUrl: z.string().nullable(),
  lastHealthAt: z.date().nullable(),
  lastHealthOk: z.boolean().nullable(),
  crashCount: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
