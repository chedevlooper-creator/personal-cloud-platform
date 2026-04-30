import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createPersonaSchema,
  personaResponseSchema,
  updatePersonaSchema,
  apiErrorCodeFromStatus,
  sendApiError,
} from '@pcp/shared';
import { PersonasService } from '../personas/service';
import { env } from '../env';
import { createAuthMiddleware } from '@pcp/shared';
import { validateSessionUserId } from '@pcp/db/src/session';

export async function setupPersonasRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const service = new PersonasService();

  const getUserId = createAuthMiddleware({
    authBypass: env.AUTH_BYPASS,
    validateSession: validateSessionUserId,
  });

  server.get(
    '/personas',
    {
      schema: {
        response: { 200: z.object({ personas: z.array(personaResponseSchema) }) },
      },
    },
    async (request, reply) => {
      const userId = await getUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');
      const rows = await service.list(userId);
      return { personas: rows };
    },
  );

  server.post(
    '/personas',
    { schema: { body: createPersonaSchema, response: { 201: personaResponseSchema } } },
    async (request, reply) => {
      const userId = await getUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');
      try {
        const row = await service.create(userId, request.body);
        return reply.code(201).send(row);
      } catch (err: any) {
        const status = err.statusCode ?? 400;
        return sendApiError(
          reply,
          status,
          apiErrorCodeFromStatus(status),
          err.message ?? 'Failed to create persona',
        );
      }
    },
  );

  server.patch(
    '/personas/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: updatePersonaSchema,
        response: { 200: personaResponseSchema },
      },
    },
    async (request, reply) => {
      const userId = await getUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');
      try {
        const row = await service.update(request.params.id, userId, request.body);
        return row;
      } catch (err: any) {
        const status = err.statusCode ?? 400;
        return sendApiError(
          reply,
          status,
          apiErrorCodeFromStatus(status),
          err.message ?? 'Failed to update persona',
        );
      }
    },
  );

  server.delete(
    '/personas/:id',
    { schema: { params: z.object({ id: z.string().uuid() }) } },
    async (request, reply) => {
      const userId = await getUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');
      try {
        await service.remove(request.params.id, userId);
        return { success: true };
      } catch (err: any) {
        const status = err.statusCode ?? 400;
        return sendApiError(
          reply,
          status,
          apiErrorCodeFromStatus(status),
          err.message ?? 'Failed to delete persona',
        );
      }
    },
  );
}
