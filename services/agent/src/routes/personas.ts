import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createPersonaSchema,
  personaResponseSchema,
  updatePersonaSchema,
} from '@pcp/shared';
import { PersonasService } from '../personas/service';
import { AgentOrchestrator } from '../orchestrator';
import { env } from '../env';

export async function setupPersonasRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const service = new PersonasService();
  const orchestrator = new AgentOrchestrator(fastify.log);

  async function getUserId(sessionId: string | undefined): Promise<string | null> {
    if (env.AUTH_BYPASS) return 'local-dev-user';
    if (!sessionId) return null;
    return orchestrator.validateUserFromCookie(sessionId);
  }

  server.get(
    '/personas',
    {
      schema: {
        response: { 200: z.object({ personas: z.array(personaResponseSchema) }) },
      },
    },
    async (request, reply) => {
      const userId = await getUserId(request.cookies.sessionId);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);
      const rows = await service.list(userId);
      return { personas: rows };
    },
  );

  server.post(
    '/personas',
    { schema: { body: createPersonaSchema, response: { 201: personaResponseSchema } } },
    async (request, reply) => {
      const userId = await getUserId(request.cookies.sessionId);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);
      try {
        const row = await service.create(userId, request.body);
        return reply.code(201).send(row);
      } catch (err: any) {
        return reply
          .code(err.statusCode ?? 400)
          .send({ error: err.message ?? 'Failed to create persona' } as any);
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
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);
      try {
        const row = await service.update(request.params.id, userId, request.body);
        return row;
      } catch (err: any) {
        return reply
          .code(err.statusCode ?? 400)
          .send({ error: err.message ?? 'Failed to update persona' } as any);
      }
    },
  );

  server.delete(
    '/personas/:id',
    { schema: { params: z.object({ id: z.string().uuid() }) } },
    async (request, reply) => {
      const userId = await getUserId(request.cookies.sessionId);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);
      try {
        await service.remove(request.params.id, userId);
        return { success: true };
      } catch (err: any) {
        return reply
          .code(err.statusCode ?? 400)
          .send({ error: err.message ?? 'Failed to delete persona' } as any);
      }
    },
  );
}
