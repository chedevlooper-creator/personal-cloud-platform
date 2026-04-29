import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  addMemorySchema,
  searchMemorySchema,
  updateMemorySchema,
  memoryResponseSchema,
  sendApiError,
} from '@pcp/shared';
import { MemoryService } from './service';
import { z } from 'zod';
import { env } from './env';
import type { FastifyRequest } from 'fastify';
import { resolveAuthenticatedUserId } from '@pcp/db/src/auth-request';

export async function setupMemoryRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const memoryService = new MemoryService(fastify.log);

  async function getAuthenticatedUserId(request: FastifyRequest): Promise<string | null> {
    return resolveAuthenticatedUserId(request, {
      internalServiceToken: env.INTERNAL_SERVICE_TOKEN,
    });
  }

  server.post(
    '/memory/entries',
    {
      schema: {
        body: addMemorySchema,
        response: {
          201: memoryResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      const { type, content, metadata, workspaceId } = request.body;
      const memory = await memoryService.addMemory(userId, type, content, metadata, workspaceId);
      
      return reply.code(201).send(memory);
    }
  );

  server.post(
    '/memory/search',
    {
      schema: {
        body: searchMemorySchema,
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      const { query, limit, type, workspaceId, minSimilarity } = request.body;
      const results = await memoryService.searchMemory(userId, query, {
        limit,
        type,
        workspaceId,
        minSimilarity,
      });

      return { results };
    }
  );

  server.patch(
    '/memory/entries/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: updateMemorySchema,
        response: {
          200: memoryResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      const updated = await memoryService.updateMemory(request.params.id, userId, request.body);
      if (!updated) return sendApiError(reply, 404, 'NOT_FOUND', 'Memory not found');
      
      return updated;
    }
  );

  server.delete(
    '/memory/entries/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      await memoryService.deleteMemory(request.params.id, userId);
      return { success: true };
    }
  );
}
