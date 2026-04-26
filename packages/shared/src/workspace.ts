import { z } from 'zod';

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(255),
});

export type CreateWorkspaceDto = z.infer<typeof createWorkspaceSchema>;

export const listWorkspacesSchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});

export type ListWorkspacesDto = z.infer<typeof listWorkspacesSchema>;

export const workspaceResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  storageUsed: z.number(),
  storageLimit: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type WorkspaceResponseDto = z.infer<typeof workspaceResponseSchema>;

export const listFilesSchema = z.object({
  path: z.string().optional().default('/'),
});

export type ListFilesDto = z.infer<typeof listFilesSchema>;

export const fileMetadataSchema = z.object({
  id: z.string().uuid(),
  path: z.string(),
  name: z.string(),
  mimeType: z.string().nullable(),
  size: z.string(),
  isDirectory: z.boolean(),
  parentPath: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type FileMetadataDto = z.infer<typeof fileMetadataSchema>;

export const moveFileSchema = z.object({
  sourcePath: z.string().min(1),
  destinationPath: z.string().min(1),
});

export type MoveFileDto = z.infer<typeof moveFileSchema>;