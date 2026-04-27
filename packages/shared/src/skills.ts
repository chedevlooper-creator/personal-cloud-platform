import { z } from 'zod';

export const skillResponseSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid().nullable(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  bodyMarkdown: z.string().nullable(),
  sourcePath: z.string().nullable(),
  triggers: z.array(z.string()),
  enabled: z.boolean(),
  metadata: z.record(z.unknown()).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createSkillSchema = z.object({
  workspaceId: z.string().uuid().nullable().optional(),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9][a-z0-9-_]*$/, 'slug must be lowercase alphanumeric/dash/underscore'),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  bodyMarkdown: z.string().max(100000).nullable().optional(),
  sourcePath: z.string().max(1024).nullable().optional(),
  triggers: z.array(z.string().min(1).max(200)).max(20).optional(),
  enabled: z.boolean().optional(),
});

export const updateSkillSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  bodyMarkdown: z.string().max(100000).nullable().optional(),
  triggers: z.array(z.string().min(1).max(200)).max(20).optional(),
  enabled: z.boolean().optional(),
});

export type SkillResponse = z.infer<typeof skillResponseSchema>;
export type CreateSkillDto = z.infer<typeof createSkillSchema>;
export type UpdateSkillDto = z.infer<typeof updateSkillSchema>;
