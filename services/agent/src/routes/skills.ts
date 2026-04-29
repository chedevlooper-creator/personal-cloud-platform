import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createSkillSchema,
  skillResponseSchema,
  updateSkillSchema,
  apiErrorCodeFromStatus,
  sendApiError,
} from '@pcp/shared';
import { SkillsService } from '../skills/service';
import { AgentOrchestrator } from '../orchestrator';
import { env } from '../env';

export async function setupSkillsRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const service = new SkillsService();
  const orchestrator = new AgentOrchestrator(fastify.log);

  async function getUserId(sessionId: string | undefined): Promise<string | null> {
    if (env.AUTH_BYPASS) return 'local-dev-user';
    if (!sessionId) return null;
    return orchestrator.validateUserFromCookie(sessionId);
  }

  server.get(
    '/skills',
    { schema: { response: { 200: z.object({ skills: z.array(skillResponseSchema) }) } } },
    async (request, reply) => {
      const userId = await getUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');
      const rows = await service.list(userId);
      return { skills: rows };
    },
  );

  server.post(
    '/skills',
    { schema: { body: createSkillSchema, response: { 201: skillResponseSchema } } },
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
          err.message ?? 'Failed to create skill',
        );
      }
    },
  );

  server.patch(
    '/skills/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: updateSkillSchema,
        response: { 200: skillResponseSchema },
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
          err.message ?? 'Failed to update skill',
        );
      }
    },
  );

  server.delete(
    '/skills/:id',
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
          err.message ?? 'Failed to delete skill',
        );
      }
    },
  );

  server.post(
    '/skills/match',
    {
      schema: {
        body: z.object({ input: z.string().min(1).max(20000) }),
        response: { 200: z.object({ skills: z.array(skillResponseSchema) }) },
      },
    },
    async (request, reply) => {
      const userId = await getUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');
      const matched = await service.matchTriggers(userId, request.body.input);
      return { skills: matched };
    },
  );
}
