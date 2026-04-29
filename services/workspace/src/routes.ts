import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  createWorkspaceSchema,
  fileContentResponseSchema,
  fileMetadataSchema,
  listFilesSchema,
  listWorkspacesSchema,
  moveFileSchema,
  workspaceResponseSchema,
  apiErrorCodeFromStatus,
  sendApiError,
} from '@pcp/shared';
import { WorkspaceError, WorkspaceService } from './service';
import { z } from 'zod';
import { setupSnapshotRoutes } from './routes/snapshots';
import { setupDatasetsRoutes } from './routes/datasets';
import { env } from './env';
import type { FastifyRequest } from 'fastify';
import { resolveAuthenticatedUserId } from '@pcp/db/src/auth-request';

export async function setupWorkspaceRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const workspaceService = new WorkspaceService(fastify.log);

  async function getAuthenticatedUserId(request: FastifyRequest): Promise<string | null> {
    return resolveAuthenticatedUserId(request, {
      internalServiceToken: env.INTERNAL_SERVICE_TOKEN,
    });
  }

  // Register sub-routes
  await setupSnapshotRoutes(fastify, workspaceService);
  await setupDatasetsRoutes(fastify);

  // Create workspace
  server.post(
    '/workspaces',
    {
      schema: {
        body: createWorkspaceSchema,
        response: {
          201: workspaceResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return sendApiError(reply, 401, 'UNAUTHORIZED');
      }

      const { name } = request.body;
      const workspace = await workspaceService.createWorkspace(userId, name);

      return reply.code(201).send(workspace);
    },
  );

  // List workspaces
  server.get(
    '/workspaces',
    {
      schema: {
        querystring: listWorkspacesSchema,
        response: {
          200: z.object({
            workspaces: z.array(workspaceResponseSchema),
            page: z.number(),
            limit: z.number(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return sendApiError(reply, 401, 'UNAUTHORIZED');
      }

      const { page, limit } = request.query;
      const results = await workspaceService.listUserWorkspaces(userId, page, limit);

      return { workspaces: results, page, limit };
    },
  );

  // Get workspace
  server.get(
    '/workspaces/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: workspaceResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return sendApiError(reply, 401, 'UNAUTHORIZED');
      }

      const workspace = await workspaceService.getWorkspace(request.params.id, userId);

      if (!workspace) {
        return sendApiError(reply, 404, 'NOT_FOUND', 'Workspace not found');
      }

      return workspace;
    },
  );

  // Delete workspace
  server.delete(
    '/workspaces/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return sendApiError(reply, 401, 'UNAUTHORIZED');
      }

      await workspaceService.deleteWorkspace(request.params.id, userId);
      return { success: true };
    },
  );

  // List files in workspace
  server.get(
    '/workspaces/:id/files',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        querystring: listFilesSchema,
        response: {
          200: z.object({
            files: z.array(fileMetadataSchema),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return sendApiError(reply, 401, 'UNAUTHORIZED');
      }

      const { path } = request.query;
      const files = await workspaceService.listFiles(request.params.id, userId, path);

      return { files };
    },
  );

  // Get single file metadata
  server.get(
    '/workspaces/:id/files/content',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        querystring: z.object({ path: z.string().min(1) }),
        response: {
          200: fileContentResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return sendApiError(reply, 401, 'UNAUTHORIZED');
      }

      try {
        return await workspaceService.getFileContent(request.params.id, userId, request.query.path);
      } catch (error) {
        if (error instanceof WorkspaceError) {
          return sendApiError(
            reply,
            error.statusCode,
            apiErrorCodeFromStatus(error.statusCode),
            error.message,
          );
        }
        throw error;
      }
    },
  );

  // Write/update a text file (used by agent write_file tool).
  server.post(
    '/workspaces/:id/files/write',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({
          path: z.string().min(1),
          content: z.string(),
          mimeType: z.string().default('text/plain'),
        }),
        response: {
          200: z.object({
            bytesWritten: z.number(),
            path: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);
      if (!userId) {
        return sendApiError(reply, 401, 'UNAUTHORIZED');
      }
      try {
        return await workspaceService.writeTextFile(
          request.params.id,
          userId,
          request.body.path,
          request.body.content,
          request.body.mimeType,
        );
      } catch (error) {
        if (error instanceof WorkspaceError) {
          return sendApiError(
            reply,
            error.statusCode,
            apiErrorCodeFromStatus(error.statusCode),
            error.message,
          );
        }
        throw error;
      }
    },
  );

  // Sync manifest: list of files with inline content (used by runtime to materialize
  // the workspace tree onto the container's host directory).
  server.get(
    '/workspaces/:id/sync/manifest',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        querystring: z.object({
          maxInlineBytes: z.coerce.number().int().positive().optional(),
        }),
        response: {
          200: z.object({
            files: z.array(
              z.object({
                path: z.string(),
                isDirectory: z.boolean(),
                size: z.number(),
                mimeType: z.string().nullable(),
                contentBase64: z.string().nullable(),
              }),
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);
      if (!userId) {
        return sendApiError(reply, 401, 'UNAUTHORIZED');
      }
      try {
        return await workspaceService.buildSyncManifest(request.params.id, userId, {
          maxInlineBytes: request.query.maxInlineBytes,
        });
      } catch (error) {
        if (error instanceof WorkspaceError) {
          return sendApiError(
            reply,
            error.statusCode,
            apiErrorCodeFromStatus(error.statusCode),
            error.message,
          );
        }
        throw error;
      }
    },
  );

  // Get single file metadata
  server.get(
    '/workspaces/:id/files/*',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
          '*': z.string(),
        }),
        response: {
          200: fileMetadataSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return sendApiError(reply, 401, 'UNAUTHORIZED');
      }

      const filePath = '/' + (request.params as any)['*'];
      const file = await workspaceService.getFile(request.params.id, userId, filePath);

      if (!file) {
        return sendApiError(reply, 404, 'NOT_FOUND', 'File not found');
      }

      return {
        ...file,
        isDirectory: file.isDirectory === '1',
        size: parseInt(file.size || '0', 10),
      };
    },
  );

  // Create file/directory
  server.post(
    '/workspaces/:id/files',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z
          .object({
            path: z.string(),
            name: z.string(),
            mimeType: z.string().optional(),
            size: z.number().default(0),
            isDirectory: z.boolean().default(false),
            parentPath: z.string().optional(),
          })
          .strict(),
        response: {
          201: fileMetadataSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return sendApiError(reply, 401, 'UNAUTHORIZED');
      }

      const file = await workspaceService.createFile(request.params.id, userId, request.body);

      return reply.code(201).send({
        ...file,
        isDirectory: file.isDirectory === '1',
        size: parseInt(file.size || '0', 10),
      });
    },
  );

  // Create directory
  server.post(
    '/workspaces/:id/directories',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({
          path: z.string(),
          name: z.string(),
          parentPath: z.string().optional(),
        }),
        response: {
          201: fileMetadataSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return sendApiError(reply, 401, 'UNAUTHORIZED');
      }

      const { path, name, parentPath } = request.body;
      const dir = await workspaceService.createDirectory(
        request.params.id,
        userId,
        path,
        name,
        parentPath,
      );

      return reply.code(201).send({
        ...dir,
        isDirectory: true,
        size: 0,
      });
    },
  );

  // Upload file
  server.post(
    '/workspaces/:id/upload',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return sendApiError(reply, 401, 'UNAUTHORIZED');
      }

      const data = await request.file();
      if (!data) {
        return sendApiError(reply, 400, 'BAD_REQUEST', 'No file uploaded');
      }

      const targetPath = (data.fields.path as any)?.value || `/${data.filename}`;
      const name = targetPath.split('/').filter(Boolean).pop() || data.filename;

      try {
        const file = await workspaceService.uploadFile(
          request.params.id,
          userId,
          targetPath,
          name,
          data.mimetype,
          data.file,
        );

        return reply.code(201).send({
          ...file,
          isDirectory: false,
          size: parseInt(file.size || '0', 10),
        });
      } catch (error) {
        if (error instanceof WorkspaceError) {
          return sendApiError(
            reply,
            error.statusCode,
            apiErrorCodeFromStatus(error.statusCode),
            error.message,
          );
        }
        throw error;
      }
    },
  );

  // Delete file
  server.delete(
    '/workspaces/:id/files/*',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
          '*': z.string(),
        }),
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return sendApiError(reply, 401, 'UNAUTHORIZED');
      }

      const filePath = '/' + (request.params as any)['*'];
      await workspaceService.deleteFile(request.params.id, userId, filePath);

      return { success: true };
    },
  );

  // Move file
  server.post(
    '/workspaces/:id/files/move',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: moveFileSchema,
        response: {
          200: fileMetadataSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return sendApiError(reply, 401, 'UNAUTHORIZED');
      }

      const { sourcePath, destinationPath } = request.body;
      const file = await workspaceService.moveFile(
        request.params.id,
        userId,
        sourcePath,
        destinationPath,
      );

      return {
        ...file,
        isDirectory: file.isDirectory === '1',
        size: parseInt(file.size || '0', 10),
      };
    },
  );
}
