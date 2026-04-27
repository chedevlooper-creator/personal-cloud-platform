import { z } from 'zod';

const hostedSlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/);

const hostedRootPathSchema = z
  .string()
  .min(1)
  .max(1024)
  .refine((path) => {
    const normalized = path.replace(/\\/g, '/');
    return !normalized.includes('..') && !normalized.includes('\0') && !normalized.startsWith('~');
  }, 'Invalid root path');

const hostedStartCommandSchema = z
  .string()
  .max(500)
  .refine((command) => !/[\r\n\0]/.test(command), 'Invalid start command')
  .optional();

export const createHostedServiceSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(80),
  slug: hostedSlugSchema,
  kind: z.enum(['static', 'vite', 'node']),
  rootPath: hostedRootPathSchema,
  startCommand: hostedStartCommandSchema,
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
