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

      logger.info({ runId, automationId, attempt: job.attemptsMade + 1 }, 'Processing automation run');

      const startedAt = new Date();
      await db
        .update(automationRuns)
        .set({ status: 'running', startedAt })
        .where(eq(automationRuns.id, runId));

      const automation = await db.query.automations.findFirst({
        where: eq(automations.id, automationId),
      });

      try {
        const task = await orchestrator.createTask(userId, workspaceId, prompt);

        await db
          .update(automationRuns)
          .set({ taskId: task.id })
          .where(eq(automationRuns.id, runId));

        // Event-driven task completion with timeout
        const terminalTask = await waitForTaskTerminalStatus(
          orchestrator,
          task.id,
          env.AUTOMATION_TIMEOUT_MS,
        );

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

        logger.info({ runId, status, durationMs }, 'Automation run finished');

        if (automation) {
          // Fire-and-forget notification delivery (never block worker)
          dispatchAutomationRunNotification(
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
          ).catch((err) => {
            logger.warn({ err, runId }, 'Notification dispatch failed');
          });
        }
      } catch (error) {
        logger.error({ runId, error, attempt: job.attemptsMade + 1 }, 'Automation run failed');
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
          // Fire-and-forget notification delivery
          dispatchAutomationRunNotification(
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
          ).catch((err) => {
            logger.warn({ err, runId }, 'Notification dispatch failed');
          });
        }

        // Re-throw so BullMQ can retry according to its config
        throw error;
      }
    },
    {
      connection,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err, attempts: job?.attemptsMade }, 'Automation job failed');
  });

  return worker;
}

/**
 * Wait for a task to reach terminal status using EventEmitter (event-driven)
 * instead of polling. Falls back to a one-time DB read if the emitter is not
 * available or if the task already completed before we subscribed.
 */
function waitForTaskTerminalStatus(
  orchestrator: AgentOrchestrator,
  taskId: string,
  timeoutMs: number,
): Promise<{ status: string; output: string | null }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Automation task timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      emitter.removeListener('task', onTask);
    }

    function onTask(data: unknown) {
      const task = data as { status?: string; output?: string | null } | null;
      if (task && ['completed', 'failed', 'cancelled'].includes(task.status ?? '')) {
        cleanup();
        resolve({ status: task.status!, output: task.output ?? null });
      }
    }

    // Subscribe to real-time task events
    const emitter = orchestrator.subscribeToTask(taskId);
    emitter.on('task', onTask);

    // Safety: do an immediate DB read in case the task already finished
    // before we subscribed (race condition at subscription time).
    orchestrator
      .getTask(taskId, '')
      .then((current) => {
        if (current && ['completed', 'failed', 'cancelled'].includes(current.status)) {
          cleanup();
          resolve({ status: current.status, output: current.output ?? null });
        }
      })
      .catch(() => {
        // Ignore — the event stream or timeout will handle it.
      });
  });
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
