import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { db } from '@pcp/db/src/client';
import { automations, automationRuns, workspaces } from '@pcp/db/src/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { AgentOrchestrator } from '../orchestrator';
import { env } from '../env';
import { dispatchAutomationRunNotification } from './notify';

// Initialize Redis connection
const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const automationQueue = new Queue('automations', { connection });

export async function setupAutomationWorker(orchestrator: AgentOrchestrator, logger: any) {
  const worker = new Worker(
    'automations',
    async (job: Job) => {
      const { runId, automationId, userId, workspaceId, prompt } = await resolveAutomationJobData(
        job.data,
      );

      logger.info({ runId, automationId }, 'Processing automation run');

      const startedAt = new Date();
      // Update run status to running
      await db
        .update(automationRuns)
        .set({ status: 'running', startedAt })
        .where(eq(automationRuns.id, runId));

      const automation = await db.query.automations.findFirst({
        where: eq(automations.id, automationId),
      });

      try {
        // Pass it to AgentOrchestrator to run
        const task = await orchestrator.createTask(userId, workspaceId, prompt);

        // Update run with taskId
        await db
          .update(automationRuns)
          .set({ taskId: task.id })
          .where(eq(automationRuns.id, runId));

        // Poll for task completion (max 10 minutes)
        const maxPollMs = 10 * 60 * 1000;
        const pollIntervalMs = 3000;
        const deadline = Date.now() + maxPollMs;
        let terminalTask = null;

        while (Date.now() < deadline) {
          const current = await orchestrator.getTask(task.id, userId);
          if (!current) {
            throw new Error('Task disappeared during automation execution');
          }
          if (['completed', 'failed', 'cancelled'].includes(current.status)) {
            terminalTask = current;
            break;
          }
          await new Promise((r) => setTimeout(r, pollIntervalMs));
        }

        if (!terminalTask) {
          throw new Error('Automation task timed out after 10 minutes');
        }

        const finishedAt = new Date();
        const durationMs = finishedAt.getTime() - startedAt.getTime();
        const status = terminalTask.status as 'completed' | 'failed' | 'cancelled';

        await db
          .update(automationRuns)
          .set({
            status,
            finishedAt,
            durationMs: durationMs.toString(),
            output: terminalTask.output,
            error: status === 'failed' ? terminalTask.output : null,
            notificationSent: true,
          })
          .where(eq(automationRuns.id, runId));

        await db
          .update(automations)
          .set({ lastRunAt: finishedAt })
          .where(eq(automations.id, automationId));

        logger.info({ runId, status }, 'Automation run finished');

        if (automation) {
          await dispatchAutomationRunNotification(
            {
              runId,
              automationId,
              userId,
              title: automation.title,
              status,
              durationMs,
              output: terminalTask.output,
              error: status === 'failed' ? terminalTask.output : null,
            },
            {
              mode: automation.notificationMode,
              webhookUrl: automation.webhookUrl,
              logger,
            },
          );
        }
      } catch (error) {
        logger.error({ runId, error }, 'Automation run failed');
        const finishedAt = new Date();
        const durationMs = finishedAt.getTime() - startedAt.getTime();
        const message = error instanceof Error ? error.message : 'Unknown error';
        await db
          .update(automationRuns)
          .set({
            status: 'failed',
            finishedAt,
            durationMs: durationMs.toString(),
            error: message,
            notificationSent: true,
          })
          .where(eq(automationRuns.id, runId));

        if (automation) {
          await dispatchAutomationRunNotification(
            {
              runId,
              automationId,
              userId,
              title: automation.title,
              status: 'failed',
              durationMs,
              error: message,
            },
            {
              mode: automation.notificationMode,
              webhookUrl: automation.webhookUrl,
              logger,
            },
          );
        }
      }
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Automation job failed');
  });

  return worker;
}

async function resolveAutomationJobData(data: {
  runId?: string;
  automationId?: string;
  userId?: string;
  workspaceId?: string | null;
  prompt?: string;
}) {
  if (data.runId && data.automationId && data.userId && data.workspaceId && data.prompt) {
    await assertWorkspaceOwned(data.userId, data.workspaceId);
    return data as {
      runId: string;
      automationId: string;
      userId: string;
      workspaceId: string;
      prompt: string;
    };
  }

  if (!data.automationId) {
    throw new Error('Automation job is missing automationId');
  }

  const automation = await db.query.automations.findFirst({
    where: eq(automations.id, data.automationId),
  });

  if (!automation || !automation.enabled) {
    throw new Error('Automation not found or disabled');
  }

  if (!automation.workspaceId) {
    throw new Error('Automation workspace is required to run');
  }

  await assertWorkspaceOwned(automation.userId, automation.workspaceId);

  const [run] = await db
    .insert(automationRuns)
    .values({
      automationId: automation.id,
      userId: automation.userId,
      trigger: 'schedule',
      status: 'queued',
    })
    .returning();

  if (!run) {
    throw new Error('Failed to create automation run');
  }

  return {
    runId: run.id,
    automationId: automation.id,
    userId: automation.userId,
    workspaceId: automation.workspaceId,
    prompt: automation.prompt,
  };
}

async function assertWorkspaceOwned(userId: string, workspaceId: string): Promise<void> {
  const workspace = await db.query.workspaces.findFirst({
    where: and(
      eq(workspaces.id, workspaceId),
      eq(workspaces.userId, userId),
      isNull(workspaces.deletedAt),
    ),
  });
  if (!workspace) throw new Error('Automation workspace not found');
}
