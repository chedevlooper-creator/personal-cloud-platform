import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  createTaskSchema,
  taskResponseSchema,
  taskStepSchema,
  conversationResponseSchema,
  messageResponseSchema,
  toolApprovalSchema,
  taskEventStreamQuerySchema,
  sendApiError,
} from '@pcp/shared';
import { AgentOrchestrator } from './orchestrator';
import { env } from './env';
import { z } from 'zod';

export async function setupAgentRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const orchestrator = new AgentOrchestrator(fastify.log);
  orchestrator.recoverInterruptedWork().catch((err) => {
    fastify.log.error({ err }, 'Failed to recover interrupted agent work');
  });

  async function getAuthenticatedUserId(sessionId: string | undefined): Promise<string | null> {
    if (env.AUTH_BYPASS) return 'local-dev-user';
    if (!sessionId) return null;
    return orchestrator.validateUserFromCookie(sessionId);
  }

  server.post(
    '/agent/chat',
    {
      schema: {
        body: z.object({
          input: z.string().min(1).max(12000),
        }),
        response: {
          200: z.object({
            content: z.string(),
            usage: z
              .object({
                promptTokens: z.number(),
                completionTokens: z.number(),
                totalTokens: z.number(),
              })
              .optional(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      const response = await orchestrator.chat(request.body.input, userId);
      return {
        content: response.content || '',
        usage: response.usage,
      };
    },
  );

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
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      const { workspaceId, conversationId, input, personaId, skillIds } = request.body;
      const task = await orchestrator.createTask(userId, workspaceId, input, conversationId, {
        personaId: personaId ?? null,
        skillIds: skillIds ?? [],
      });
      return reply.code(201).send(task);
    },
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
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      const task = await orchestrator.getTask(request.params.id, userId);
      if (!task) return sendApiError(reply, 404, 'NOT_FOUND', 'Task not found');

      return task;
    },
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
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      const steps = await orchestrator.getTaskSteps(request.params.id, userId);
      return { steps };
    },
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
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      await orchestrator.cancelTask(request.params.id, userId);
      return { success: true };
    },
  );

  server.get(
    '/agent/conversations',
    {
      schema: {
        response: {
          200: z.object({
            conversations: z.array(conversationResponseSchema),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      const convos = await orchestrator.getConversations(userId);
      return { conversations: convos };
    },
  );

  server.get(
    '/agent/conversations/:id/messages',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: z.object({
            messages: z.array(messageResponseSchema),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      const messages = await orchestrator.getMessages(request.params.id, userId);
      return { messages };
    },
  );

  server.post(
    '/agent/tasks/:id/tool-approval',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: toolApprovalSchema,
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      await orchestrator.submitToolApproval(
        request.params.id,
        userId,
        request.body.decision,
        request.body.reason,
      );
      return { success: true };
    },
  );

  server.delete(
    '/agent/conversations/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');
      await orchestrator.deleteConversation(request.params.id, userId);
      return { success: true };
    },
  );

  server.get(
    '/agent/tasks/:id/events',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        querystring: taskEventStreamQuerySchema,
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      const { id } = request.params;
      const { snapshot } = request.query;

      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.statusCode = 200;

      const sendEvent = (event: string, data: unknown): void => {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      if (snapshot) {
        const task = await orchestrator.getTask(id, userId);
        if (task) {
          sendEvent('task', task);
          const steps = await orchestrator.getTaskSteps(id, userId);
          for (const step of steps) {
            sendEvent('step', step);
          }
        }
        reply.raw.end();
        return reply;
      }

      // Live push: subscribe to in-process task events
      const emitter = orchestrator.subscribeToTask(id);

      const onTask = (data: unknown): void => {
        sendEvent('task', data);
        const d = data as { status?: string };
        if (d.status && ['completed', 'failed', 'cancelled'].includes(d.status)) {
          cleanup();
          reply.raw.end();
        }
      };
      const onStep = (data: unknown): void => sendEvent('step', data);

      emitter.on('task', onTask);
      emitter.on('step', onStep);

      function cleanup() {
        emitter.off('task', onTask);
        emitter.off('step', onStep);
      }

      request.raw.on('close', cleanup);
      return reply;
    },
  );
}
