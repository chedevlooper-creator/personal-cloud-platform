import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createTaskSchema, taskResponseSchema, taskStepSchema } from '@pcp/shared';
import { AgentOrchestrator } from './orchestrator';
import { z } from 'zod';

export async function setupAgentRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const orchestrator = new AgentOrchestrator(fastify.log);

  async function getAuthenticatedUserId(sessionId: string | undefined): Promise<string | null> {
    if (!sessionId) return null;
    return orchestrator.validateUserFromCookie(sessionId);
  }

  server.post(
    '/agent/tasks',
    {
      schema: {
        body: createTaskSchema,
        response: {
          201: taskResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);

      const { workspaceId, input } = request.body;
      const task = await orchestrator.createTask(userId, workspaceId, input);
      return reply.code(201).send(task);
    }
  );

  server.get(
    '/agent/tasks/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: taskResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);

      const task = await orchestrator.getTask(request.params.id, userId);
      if (!task) return reply.code(404).send({ error: 'Task not found' } as any);
      
      return task;
    }
  );

  server.get(
    '/agent/tasks/:id/steps',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: z.object({ steps: z.array(taskStepSchema) }),
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);

      const steps = await orchestrator.getTaskSteps(request.params.id, userId);
      return { steps };
    }
  );

  server.post(
    '/agent/tasks/:id/cancel',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);

      await orchestrator.cancelTask(request.params.id, userId);
      return { success: true };
    }
  );
}
