import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { db } from '@pcp/db/src/client';
import { automationRuns } from '@pcp/db/src/schema';
import { eq } from 'drizzle-orm';
import { AgentOrchestrator } from '../orchestrator';
import { env } from '../env';

// Initialize Redis connection
const connection = new IORedis(env.REDIS_URL);

export const automationQueue = new Queue('automations', { connection });

export async function setupAutomationWorker(orchestrator: AgentOrchestrator, logger: any) {
  const worker = new Worker(
    'automations',
    async (job: Job) => {
      const { runId, automationId, userId, workspaceId, prompt } = job.data;

      logger.info({ runId, automationId }, 'Processing automation run');

      // Update run status to running
      await db
        .update(automationRuns)
        .set({ status: 'running', startedAt: new Date() })
        .where(eq(automationRuns.id, runId));

      try {
        // Pass it to AgentOrchestrator to run
        const task = await orchestrator.createTask(userId, workspaceId, prompt);

        // Update run with taskId
        await db
          .update(automationRuns)
          .set({ taskId: task.id })
          .where(eq(automationRuns.id, runId));

        // In a real long-running scenario, we would wait for task completion.
        // For now, since the task executes asynchronously or synchronously, we just mark it as completed.
        // If we need the actual task output, we can poll or hook into task completion events.
        await db
          .update(automationRuns)
          .set({ status: 'completed', finishedAt: new Date() })
          .where(eq(automationRuns.id, runId));

        logger.info({ runId }, 'Automation run completed');
      } catch (error) {
        logger.error({ runId, error }, 'Automation run failed');
        await db
          .update(automationRuns)
          .set({
            status: 'failed',
            finishedAt: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          .where(eq(automationRuns.id, runId));
      }
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Automation job failed');
  });

  return worker;
}
