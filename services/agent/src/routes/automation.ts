import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { db } from '@pcp/db/src/client';
import { automations, automationRuns, workspaces } from '@pcp/db/src/schema';
import { validateSessionUserId } from '@pcp/db/src/session';
import { and, eq, desc, isNull } from 'drizzle-orm';
import { createAutomationSchema, updateAutomationSchema, sendApiError, createAuthMiddleware } from '@pcp/shared';
import { automationQueue } from '../automation/queue';
import { automationRepeatKey, computeNextRunAt, resolveSchedule } from '../automation/schedule';
import { automationTriggerToken, verifyAutomationTriggerToken } from '../automation/notify';
import { z } from 'zod';

export async function setupAutomationRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();

  const getAuthenticatedUserId = createAuthMiddleware({
    validateSession: validateSessionUserId,
  });

  async function assertWorkspaceOwned(workspaceId: string | undefined | null, userId: string) {
    if (!workspaceId) return true;
    const workspace = await db.query.workspaces.findFirst({
      where: and(
        eq(workspaces.id, workspaceId),
        eq(workspaces.userId, userId),
        isNull(workspaces.deletedAt),
      ),
    });
    return Boolean(workspace);
  }

  server.get(
    '/automations',
    {
      schema: {
        querystring: z.object({ workspaceId: z.string().uuid().optional() }),
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');
      const { workspaceId } = request.query;

      if (!(await assertWorkspaceOwned(workspaceId, userId))) {
        return sendApiError(reply, 404, 'NOT_FOUND', 'Workspace not found');
      }

      const items = await db.query.automations.findMany({
        where: workspaceId
          ? and(eq(automations.userId, userId), eq(automations.workspaceId, workspaceId))
          : eq(automations.userId, userId),
        orderBy: [desc(automations.createdAt)],
      });

      return { automations: items };
    },
  );

  server.post(
    '/automations',
    {
      schema: { body: createAutomationSchema },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      if (!(await assertWorkspaceOwned(request.body.workspaceId, userId))) {
        return sendApiError(reply, 404, 'NOT_FOUND', 'Workspace not found');
      }

      const nextRunAt = computeNextRunAt(request.body);

      const [automation] = await db
        .insert(automations)
        .values({
          userId,
          ...request.body,
          nextRunAt,
        })
        .returning();
      if (!automation) throw new Error('Failed to create automation');

      const schedule = resolveSchedule(automation);
      if (automation.enabled && schedule.isRepeating && schedule.pattern) {
        await automationQueue.add(
          'scheduled-run',
          { automationId: automation.id },
          {
            repeat: {
              pattern: schedule.pattern,
              ...(schedule.timezone ? { tz: schedule.timezone } : {}),
            },
            jobId: automationRepeatKey(automation.id),
          },
        );
      }

      return reply.code(201).send({
        ...automation,
        triggerToken: automationTriggerToken(automation.id),
      });
    },
  );

  server.patch(
    '/automations/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: updateAutomationSchema,
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      const { id } = request.params;

      if (!(await assertWorkspaceOwned(request.body.workspaceId, userId))) {
        return sendApiError(reply, 404, 'NOT_FOUND', 'Workspace not found');
      }

      const nextRunAt = computeNextRunAt({
        scheduleType: request.body.scheduleType ?? 'manual',
        cronExpression: request.body.cronExpression ?? null,
        timezone: request.body.timezone ?? null,
      });

      const [updated] = await db
        .update(automations)
        .set({
          ...request.body,
          ...(request.body.scheduleType !== undefined ? { nextRunAt } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(automations.id, id), eq(automations.userId, userId)))
        .returning();

      if (!updated) return sendApiError(reply, 404, 'NOT_FOUND', 'Not found');

      // Re-register the repeat: always remove the existing key first; then add
      // a fresh repeat job if the automation is enabled and has a schedule.
      try {
        await automationQueue.removeRepeatableByKey(automationRepeatKey(id));
      } catch {
        // ignore — key may not exist
      }
      const schedule = resolveSchedule(updated);
      if (updated.enabled && schedule.isRepeating && schedule.pattern) {
        await automationQueue.add(
          'scheduled-run',
          { automationId: updated.id },
          {
            repeat: {
              pattern: schedule.pattern,
              ...(schedule.timezone ? { tz: schedule.timezone } : {}),
            },
            jobId: automationRepeatKey(updated.id),
          },
        );
      }

      return updated;
    },
  );

  server.delete(
    '/automations/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      const { id } = request.params;
      await db
        .delete(automations)
        .where(and(eq(automations.id, id), eq(automations.userId, userId)));
      try {
        await automationQueue.removeRepeatableByKey(automationRepeatKey(id));
      } catch {
        // ignore
      }

      return { success: true };
    },
  );

  // Manual trigger
  server.post(
    '/automations/:id/run',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      const { id } = request.params;
      const automation = await db.query.automations.findFirst({
        where: and(eq(automations.id, id), eq(automations.userId, userId)),
      });

      if (!automation) return sendApiError(reply, 404, 'NOT_FOUND', 'Not found');
      if (!automation.workspaceId) {
        return sendApiError(reply, 400, 'BAD_REQUEST', 'Automation missing workspace');
      }
      if (!(await assertWorkspaceOwned(automation.workspaceId, userId))) {
        return sendApiError(reply, 404, 'NOT_FOUND', 'Workspace not found');
      }

      // Create a run record
      const [run] = await db
        .insert(automationRuns)
        .values({
          automationId: automation.id,
          userId,
          trigger: 'manual',
          status: 'queued',
        })
        .returning();
      if (!run) throw new Error('Failed to create run');

      // Add to BullMQ
      await automationQueue.add('manual-run', {
        runId: run.id,
        automationId: automation.id,
        userId,
        workspaceId: automation.workspaceId,
        prompt: automation.prompt,
      });

      return run;
    },
  );

  // Get runs
  server.get(
    '/automations/:id/runs',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      const { id } = request.params;
      const automation = await db.query.automations.findFirst({
        where: and(eq(automations.id, id), eq(automations.userId, userId)),
      });
      if (!automation) return sendApiError(reply, 404, 'NOT_FOUND', 'Not found');

      const runs = await db.query.automationRuns.findMany({
        where: and(eq(automationRuns.automationId, id), eq(automationRuns.userId, userId)),
        orderBy: [desc(automationRuns.createdAt)],
      });

      return { runs };
    },
  );

  // Return the inbound webhook trigger token. Callers use this to construct a
  // public webhook URL that can fire a manual run without a session cookie.
  server.get(
    '/automations/:id/trigger-token',
    {
      schema: { params: z.object({ id: z.string().uuid() }) },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      const automation = await db.query.automations.findFirst({
        where: and(eq(automations.id, request.params.id), eq(automations.userId, userId)),
      });
      if (!automation) return sendApiError(reply, 404, 'NOT_FOUND', 'Not found');

      return { token: automationTriggerToken(automation.id) };
    },
  );

  // Inbound public webhook trigger. Validated via constant-time HMAC token
  // (no session cookie required). Always enqueues a manual run.
  server.post(
    '/automations/:id/trigger',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        querystring: z.object({ token: z.string().min(8) }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { token } = request.query;

      if (!verifyAutomationTriggerToken(id, token)) {
        return sendApiError(reply, 401, 'UNAUTHORIZED', 'Invalid trigger token');
      }

      const automation = await db.query.automations.findFirst({
        where: eq(automations.id, id),
      });
      if (!automation || !automation.enabled) {
        return sendApiError(reply, 404, 'NOT_FOUND', 'Automation not found or disabled');
      }
      if (!automation.workspaceId) {
        return sendApiError(reply, 400, 'BAD_REQUEST', 'Automation missing workspace');
      }
      if (!(await assertWorkspaceOwned(automation.workspaceId, automation.userId))) {
        return sendApiError(reply, 404, 'NOT_FOUND', 'Workspace not found');
      }

      const [run] = await db
        .insert(automationRuns)
        .values({
          automationId: automation.id,
          userId: automation.userId,
          trigger: 'webhook',
          status: 'queued',
        })
        .returning();
      if (!run) throw new Error('Failed to create run');

      await automationQueue.add('webhook-run', {
        runId: run.id,
        automationId: automation.id,
        userId: automation.userId,
        workspaceId: automation.workspaceId,
        prompt: automation.prompt,
      });

      return reply.code(202).send({ runId: run.id });
    },
  );
}
