import { z } from 'zod';

export const personaResponseSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  systemPrompt: z.string(),
  icon: z.string().nullable().optional(),
  isDefault: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createPersonaSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-_]*$/, 'slug must be lowercase alphanumeric/dash/underscore'),
  name: z.string().min(1).max(120),
  systemPrompt: z.string().min(1).max(20000),
  icon: z.string().max(80).nullable().optional(),
  isDefault: z.boolean().optional(),
});

export const updatePersonaSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  systemPrompt: z.string().min(1).max(20000).optional(),
  icon: z.string().max(80).nullable().optional(),
  isDefault: z.boolean().optional(),
});

export type PersonaResponse = z.infer<typeof personaResponseSchema>;
export type CreatePersonaDto = z.infer<typeof createPersonaSchema>;
export type UpdatePersonaDto = z.infer<typeof updatePersonaSchema>;
