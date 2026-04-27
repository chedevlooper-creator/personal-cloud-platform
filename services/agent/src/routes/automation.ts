import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { db } from '@pcp/db/src/client';
import { automations, automationRuns } from '@pcp/db/src/schema';
import { eq, desc } from 'drizzle-orm';
import { createAutomationSchema, updateAutomationSchema } from '@pcp/shared';
import { automationQueue } from '../automation/queue';
import { z } from 'zod';

export async function setupAutomationRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();

  async function getAuthenticatedUserId(sessionId: string | undefined): Promise<string | null> {
    // We would use the AgentOrchestrator to validate user from cookie.
    // For now we assume a simple placeholder since we don't have access to orchestrator instance easily here without passing it.
    // However, in a real implementation we would fetch the session exactly like orchestrator.validateUserFromCookie
    // To be consistent, let's just do it directly.
    if (!sessionId) return null;
    const session = await db.query.sessions.findFirst({
      where: (s) => eq(s.id, sessionId),
    });
    return session?.expiresAt.getTime()! > Date.now() ? session?.userId || null : null;
  }

  server.get(
    '/automations',
    {
      schema: {
        querystring: z.object({ workspaceId: z.string().uuid().optional() })
      }
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);

      const items = await db.query.automations.findMany({
        where: eq(automations.userId, userId),
        orderBy: [desc(automations.createdAt)]
      });

      return { automations: items };
    }
  );

  server.post(
    '/automations',
    {
      schema: { body: createAutomationSchema }
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);

      const [automation] = await db.insert(automations).values({
        userId,
        ...request.body,
      }).returning();
      if (!automation) throw new Error('Failed to create automation');

      // If it's a cron/schedule, we should add it to bullmq
      if (automation.scheduleType !== 'manual' && automation.cronExpression) {
        await automationQueue.add('scheduled-run', { automationId: automation.id }, {
          repeat: { pattern: automation.cronExpression },
          jobId: `automation-${automation.id}`
        });
      }

      return reply.code(201).send(automation);
    }
  );

  server.patch(
    '/automations/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: updateAutomationSchema
      }
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);

      const { id } = request.params;
      
      const [updated] = await db.update(automations)
        .set({ ...request.body, updatedAt: new Date() })
        .where(eq(automations.id, id))
        .returning();

      if (!updated) return reply.code(404).send({ error: 'Not found' } as any);

      // Handle cron updates (remove old, add new if needed)
      // This is a simplified version.
      if (request.body.enabled === false) {
        await automationQueue.removeRepeatableByKey(`automation-${id}`);
      }

      return updated;
    }
  );

  server.delete(
    '/automations/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      }
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);

      const { id } = request.params;
      await db.delete(automations).where(eq(automations.id, id));
      await automationQueue.removeRepeatableByKey(`automation-${id}`);

      return { success: true };
    }
  );

  // Manual trigger
  server.post(
    '/automations/:id/run',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      }
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);

      const { id } = request.params;
      const automation = await db.query.automations.findFirst({
        where: eq(automations.id, id)
      });

      if (!automation) return reply.code(404).send({ error: 'Not found' } as any);

      // Create a run record
      const [run] = await db.insert(automationRuns).values({
        automationId: automation.id,
        userId,
        trigger: 'manual',
        status: 'queued',
      }).returning();
      if (!run) throw new Error('Failed to create run');

      // Add to BullMQ
      await automationQueue.add('manual-run', {
        runId: run.id,
        automationId: automation.id,
        userId: automation.userId,
        workspaceId: automation.workspaceId,
        prompt: automation.prompt,
      });

      return run;
    }
  );

  // Get runs
  server.get(
    '/automations/:id/runs',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      }
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);

      const { id } = request.params;
      const runs = await db.query.automationRuns.findMany({
        where: eq(automationRuns.automationId, id),
        orderBy: [desc(automationRuns.createdAt)]
      });

      return { runs };
    }
  );
}
