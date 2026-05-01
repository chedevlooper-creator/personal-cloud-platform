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
  createAuthMiddleware,
} from '@pcp/shared';
import { validateSessionUserId } from '@pcp/db/src/session';
import { db } from '@pcp/db/src/client';
import { tokenUsage, userPreferences } from '@pcp/db/src/schema';
import { and, eq, sql } from 'drizzle-orm';
import { AgentOrchestrator } from './orchestrator';
import { env } from './env';
import { z } from 'zod';
import { checkAgentRateLimit, AGENT_RATE_LIMITS } from './rate-limit';

const TERMINAL_TASK_STATUSES = new Set(['completed', 'failed', 'cancelled']);

function isTerminalTaskStatus(status: string | undefined): boolean {
  return Boolean(status && TERMINAL_TASK_STATUSES.has(status));
}

export async function setupAgentRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const orchestrator = new AgentOrchestrator(fastify.log);
  orchestrator.recoverInterruptedWork().catch((err) => {
    fastify.log.error({ err }, 'Failed to recover interrupted agent work');
  });

  const getAuthenticatedUserId = createAuthMiddleware({
    authBypass: env.AUTH_BYPASS,
    validateSession: validateSessionUserId,
  });

  async function enforceRateLimit(
    reply: any,
    userId: string,
    action: keyof typeof AGENT_RATE_LIMITS,
  ): Promise<boolean> {
    const { windowMs, maxRequests } = AGENT_RATE_LIMITS[action];
    const result = await checkAgentRateLimit(userId, action, windowMs, maxRequests);
    reply.header('X-RateLimit-Limit', maxRequests);
    reply.header('X-RateLimit-Remaining', Math.max(0, result.remaining));
    reply.header('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));
    if (!result.allowed) {
      reply.header('Retry-After', Math.ceil((result.resetAt - Date.now()) / 1000));
      sendApiError(reply, 429, 'RATE_LIMITED', 'Rate limit exceeded. Please try again later.');
      return false;
    }
    return true;
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
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');
      if (!(await enforceRateLimit(reply, userId, 'taskCreate'))) return;

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
        querystring: z.object({ workspaceId: z.string().uuid().optional() }),
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

      const convos = await orchestrator.getConversations(userId, request.query.workspaceId);
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
      if (!(await enforceRateLimit(reply, userId, 'toolApproval'))) return;

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
      if (!(await enforceRateLimit(reply, userId, 'events'))) return;

      const { id } = request.params;
      const { snapshot } = request.query;

      const startEventStream = (): void => {
        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');
        reply.raw.statusCode = 200;
      };

      const sendEvent = (event: string, data: unknown): void => {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      if (snapshot) {
        startEventStream();
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

      const currentTask = await orchestrator.getTask(id, userId);
      if (!currentTask) {
        return sendApiError(reply, 404, 'NOT_FOUND', 'Task not found');
      }

      startEventStream();

      if (isTerminalTaskStatus(currentTask.status)) {
        sendEvent('task', currentTask);
        reply.raw.end();
        return reply;
      }

      // Live push: subscribe to in-process task events after proving ownership.
      const emitter = orchestrator.subscribeToTask(id);
      let closed = false;

      const onTask = (data: unknown): void => {
        if (closed) return;
        sendEvent('task', data);
        const d = data as { status?: string };
        if (isTerminalTaskStatus(d.status)) {
          closeStream();
        }
      };
      const onStep = (data: unknown): void => {
        if (!closed) sendEvent('step', data);
      };

      emitter.on('task', onTask);
      if (!closed) emitter.on('step', onStep);

      function cleanup() {
        emitter.off('task', onTask);
        emitter.off('step', onStep);
        orchestrator.releaseTaskSubscription(id, emitter);
      }

      function closeStream() {
        if (closed) return;
        closed = true;
        cleanup();
        reply.raw.end();
      }

      if (closed) {
        return reply;
      }

      request.raw.on('close', () => {
        closed = true;
        cleanup();
      });

      const latestTask = await orchestrator.getTask(id, userId);
      if (!latestTask) {
        closeStream();
        return reply;
      }

      if (!closed) {
        sendEvent('task', latestTask);
        if (isTerminalTaskStatus(latestTask.status)) {
          closeStream();
        }
      }

      return reply;
    },
  );

  server.get('/agent/usage', async (request, reply) => {
    const userId = await getAuthenticatedUserId(request.cookies.sessionId);
    if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

    const yearMonth = new Date().toISOString().slice(0, 7);

    const [usageRows, prefs] = await Promise.all([
      db
        .select({
          provider: tokenUsage.provider,
          model: tokenUsage.model,
          promptTokens: sql<number>`COALESCE(SUM(${tokenUsage.promptTokens}), 0)`,
          completionTokens: sql<number>`COALESCE(SUM(${tokenUsage.completionTokens}), 0)`,
          totalTokens: sql<number>`COALESCE(SUM(${tokenUsage.totalTokens}), 0)`,
          requests: sql<number>`COALESCE(SUM(${tokenUsage.requestCount}), 0)`,
        })
        .from(tokenUsage)
        .where(and(eq(tokenUsage.userId, userId), eq(tokenUsage.yearMonth, yearMonth)))
        .groupBy(tokenUsage.provider, tokenUsage.model),
      db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, userId),
      }),
    ]);

    const quota = prefs?.monthlyTokenQuota ?? 100_000;
    const providers = usageRows.map((r) => ({
      provider: r.provider,
      model: r.model,
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      totalTokens: r.totalTokens,
      requests: r.requests,
    }));

    const totalUsed = providers.reduce((sum, p) => sum + p.totalTokens, 0);

    return {
      month: yearMonth,
      quota: { limit: quota, used: totalUsed },
      providers,
    };
  });
}
