import { z } from 'zod';

export const createSnapshotSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().optional(),
});

export const snapshotResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  storageKey: z.string(),
  sizeBytes: z.string(),
  fileCount: z.number(),
  kind: z.string(),
  status: z.string(),
  error: z.string().nullable(),
  createdAt: z.date(),
});
