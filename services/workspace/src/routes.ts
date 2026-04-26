import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createWorkspaceSchema, listWorkspacesSchema, listFilesSchema, moveFileSchema, workspaceResponseSchema, fileMetadataSchema } from '@pcp/shared';
import { WorkspaceService } from './service';
import { z } from 'zod';

export async function setupWorkspaceRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const workspaceService = new WorkspaceService(fastify.log);

  async function getAuthenticatedUserId(sessionId: string | undefined): Promise<string | null> {
    if (!sessionId) return null;
    return workspaceService.validateUserFromCookie(sessionId);
  }

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
      const sessionId = request.cookies.sessionId;
      const userId = await getAuthenticatedUserId(sessionId);
      
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' } as any);
      }

      const { name } = request.body;
      const workspace = await workspaceService.createWorkspace(userId, name);
      
      return reply.code(201).send(workspace);
    }
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
      const sessionId = request.cookies.sessionId;
      const userId = await getAuthenticatedUserId(sessionId);
      
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' } as any);
      }

      const { page, limit } = request.query;
      const results = await workspaceService.listUserWorkspaces(userId, page, limit);
      
      return { workspaces: results, page, limit };
    }
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
      const sessionId = request.cookies.sessionId;
      const userId = await getAuthenticatedUserId(sessionId);
      
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' } as any);
      }

      const workspace = await workspaceService.getWorkspace(request.params.id, userId);
      
      if (!workspace) {
        return reply.code(404).send({ error: 'Workspace not found' } as any);
      }

      return workspace;
    }
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
      const sessionId = request.cookies.sessionId;
      const userId = await getAuthenticatedUserId(sessionId);
      
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' } as any);
      }

      await workspaceService.deleteWorkspace(request.params.id, userId);
      return { success: true };
    }
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
      const sessionId = request.cookies.sessionId;
      const userId = await getAuthenticatedUserId(sessionId);
      
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' } as any);
      }

      const { path } = request.query;
      const files = await workspaceService.listFiles(request.params.id, userId, path);
      
      return { files };
    }
  );

  // Get single file metadata
  server.get(
    '/workspaces/:id/files/*path',
    {
      schema: {
        params: z.object({ 
          id: z.string().uuid(),
          path: z.string(),
        }),
        response: {
          200: fileMetadataSchema,
        },
      },
    },
    async (request, reply) => {
      const sessionId = request.cookies.sessionId;
      const userId = await getAuthenticatedUserId(sessionId);
      
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' } as any);
      }

      const filePath = '/' + request.params.path;
      const file = await workspaceService.getFile(request.params.id, userId, filePath);
      
      if (!file) {
        return reply.code(404).send({ error: 'File not found' } as any);
      }

      return {
        ...file,
        isDirectory: file.isDirectory === '1',
        size: parseInt(file.size || '0', 10),
      };
    }
  );

  // Create file/directory
  server.post(
    '/workspaces/:id/files',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({
          path: z.string(),
          name: z.string(),
          mimeType: z.string().optional(),
          size: z.number().default(0),
          storageKey: z.string().default(''),
          isDirectory: z.boolean().default(false),
          parentPath: z.string().optional(),
        }),
        response: {
          201: fileMetadataSchema,
        },
      },
    },
    async (request, reply) => {
      const sessionId = request.cookies.sessionId;
      const userId = await getAuthenticatedUserId(sessionId);
      
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' } as any);
      }

      const file = await workspaceService.createFile(request.params.id, userId, request.body);
      
      return reply.code(201).send({
        ...file,
        isDirectory: file.isDirectory === '1',
        size: parseInt(file.size || '0', 10),
      });
    }
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
      const sessionId = request.cookies.sessionId;
      const userId = await getAuthenticatedUserId(sessionId);
      
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' } as any);
      }

      const { path, name, parentPath } = request.body;
      const dir = await workspaceService.createDirectory(request.params.id, userId, path, name, parentPath);
      
      return reply.code(201).send({
        ...dir,
        isDirectory: true,
        size: 0,
      });
    }
  );

  // Delete file
  server.delete(
    '/workspaces/:id/files/*path',
    {
      schema: {
        params: z.object({ 
          id: z.string().uuid(),
          path: z.string(),
        }),
      },
    },
    async (request, reply) => {
      const sessionId = request.cookies.sessionId;
      const userId = await getAuthenticatedUserId(sessionId);
      
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' } as any);
      }

      const filePath = '/' + request.params.path;
      await workspaceService.deleteFile(request.params.id, userId, filePath);
      
      return { success: true };
    }
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
      const sessionId = request.cookies.sessionId;
      const userId = await getAuthenticatedUserId(sessionId);
      
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' } as any);
      }

      const { sourcePath, destinationPath } = request.body;
      const file = await workspaceService.moveFile(request.params.id, userId, sourcePath, destinationPath);
      
      return {
        ...file,
        isDirectory: file.isDirectory === '1',
        size: parseInt(file.size || '0', 10),
      };
    }
  );
}