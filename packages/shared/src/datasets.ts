import { z } from 'zod';

export const datasetColumnSchema = z.object({
  name: z.string(),
  type: z.string(),
});

export const datasetResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  tableName: z.string(),
  sourceType: z.string(),
  sourceFilename: z.string().nullable().optional(),
  columns: z.array(datasetColumnSchema),
  rowCount: z.number(),
  sizeBytes: z.number(),
  version: z.number(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export const queryDatasetSchema = z.object({
  sql: z.string().min(1).max(20000),
  rowLimit: z.number().int().min(1).max(10000).optional(),
});

export const queryResultSchema = z.object({
  columns: z.array(datasetColumnSchema),
  rows: z.array(z.array(z.any())),
  rowCount: z.number(),
  truncated: z.boolean(),
  durationMs: z.number(),
});

export type DatasetResponse = z.infer<typeof datasetResponseSchema>;
export type DatasetColumn = z.infer<typeof datasetColumnSchema>;
export type QueryDatasetDto = z.infer<typeof queryDatasetSchema>;
export type QueryResult = z.infer<typeof queryResultSchema>;
