import { z } from 'zod';

export const browserSessionSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  title: z.string(),
  createdAt: z.union([z.string(), z.date()]),
  lastUsedAt: z.union([z.string(), z.date()]),
});

export const navigateSchema = z.object({ url: z.string().url().max(2048) });
export const clickSchema = z.object({ selector: z.string().min(1).max(500) });
export const fillSchema = z.object({
  selector: z.string().min(1).max(500),
  value: z.string().max(10000),
});

export type BrowserSession = z.infer<typeof browserSessionSchema>;
