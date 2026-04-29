import { z } from 'zod';

export const addMemorySchema = z.object({
  workspaceId: z.string().uuid().optional(),
  type: z.string(),
  content: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

export const searchMemorySchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(50).optional().default(5),
  type: z.string().optional(),
  workspaceId: z.string().uuid().optional(),
  /**
   * Optional cosine-similarity floor in [-1, 1]. Results with `similarity`
   * below this value are dropped. Vectors are L2-normalized, so similarity
   * is computed as `1 - ||a - b||^2 / 2` from pgvector's L2 distance.
   */
  minSimilarity: z.number().min(-1).max(1).optional(),
});

export const updateMemorySchema = z.object({
  content: z.string().optional(),
  type: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const memoryResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  workspaceId: z.string().uuid().nullable(),
  type: z.string(),
  content: z.string(),
  metadata: z.any(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
