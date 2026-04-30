import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
import pino from 'pino';

const USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const AUTOMATION_ID = '550e8400-e29b-41d4-a716-446655440002';
const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440003';
const TASK_ID = '550e8400-e29b-41d4-a716-446655440005';

const { mockDb, capturedWorker } = vi.hoisted(() => {
  const capturedWorker = {
    processor: undefined as undefined | ((job: { data: Record<string, unknown> }) => Promise<void>),
  };

  const mockDb = {
    query: {
      automations: {
        findFirst: vi.fn(),
      },
      workspaces: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [
          {
            id: '550e8400-e29b-41d4-a716-446655440004',
            automationId: '550e8400-e29b-41d4-a716-446655440002',
            userId: '550e8400-e29b-41d4-a716-446655440001',
            trigger: 'schedule',
            status: 'queued',
          },
        ]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  };

  return { mockDb, capturedWorker };
});

vi.mock('@pcp/db/src/client', () => ({
  db: mockDb,
}));

vi.mock('ioredis', () => ({
  default: vi.fn(),
}));

vi.mock('bullmq', () => ({
  Queue: vi.fn(),
  Worker: vi.fn(
    (_name: string, processor: (job: { data: Record<string, unknown> }) => Promise<void>) => {
      capturedWorker.processor = processor;
      return {
        on: vi.fn(),
      };
    },
  ),
}));

vi.mock('drizzle-orm', () => ({
  and: (...conditions: unknown[]) => ({ type: 'and', conditions }),
  eq: (column: unknown, value: unknown) => ({ type: 'eq', column, value }),
  isNull: (column: unknown) => ({ type: 'isNull', column }),
}));

function createMockOrchestrator() {
  const emitter = new EventEmitter();
  return {
    createTask: vi.fn(async () => ({ id: TASK_ID })),
    getTask: vi.fn().mockResolvedValue(null),
    subscribeToTask: vi.fn(() => emitter),
    _emitter: emitter,
  };
}

describe('automation worker scheduled jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedWorker.processor = undefined;
    mockDb.query.automations.findFirst.mockResolvedValue({
      id: AUTOMATION_ID,
      userId: USER_ID,
      workspaceId: WORKSPACE_ID,
      prompt: 'Summarize',
      enabled: true,
    });
    mockDb.query.workspaces.findFirst.mockResolvedValue({
      id: WORKSPACE_ID,
      userId: USER_ID,
      deletedAt: null,
    });
  });

  it('loads scheduled automation data and creates a fresh run at execution time', async () => {
    const { setupAutomationWorker } = await import('./queue');
    const orchestrator = createMockOrchestrator();
    // Safety check returns completed immediately
    orchestrator.getTask.mockResolvedValueOnce({
      id: TASK_ID,
      status: 'completed',
      output: 'Done',
    });

    await setupAutomationWorker(orchestrator as any, pino({ level: 'silent' }));
    await capturedWorker.processor?.({ data: { automationId: AUTOMATION_ID } });

    expect(mockDb.query.automations.findFirst).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
    expect(orchestrator.createTask).toHaveBeenCalledWith(USER_ID, WORKSPACE_ID, 'Summarize');
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('does not run scheduled automations for unowned workspaces', async () => {
    const { setupAutomationWorker } = await import('./queue');
    const orchestrator = createMockOrchestrator();
    mockDb.query.workspaces.findFirst.mockResolvedValueOnce(null);

    await setupAutomationWorker(orchestrator as any, pino({ level: 'silent' }));
    await expect(capturedWorker.processor?.({ data: { automationId: AUTOMATION_ID } })).rejects.toThrow(
      'Automation workspace not found',
    );

    expect(orchestrator.createTask).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('does not run queued jobs carrying an unowned workspace id', async () => {
    const { setupAutomationWorker } = await import('./queue');
    const orchestrator = createMockOrchestrator();
    mockDb.query.workspaces.findFirst.mockResolvedValueOnce(null);

    await setupAutomationWorker(orchestrator as any, pino({ level: 'silent' }));
    await expect(
      capturedWorker.processor?.({
        data: {
          runId: '550e8400-e29b-41d4-a716-446655440004',
          automationId: AUTOMATION_ID,
          userId: USER_ID,
          workspaceId: WORKSPACE_ID,
          prompt: 'Summarize',
        },
      }),
    ).rejects.toThrow('Automation workspace not found');

    expect(orchestrator.createTask).not.toHaveBeenCalled();
  });

  it('waits for task event and updates run status when task finishes', async () => {
    const { setupAutomationWorker } = await import('./queue');
    const orchestrator = createMockOrchestrator();

    // Safety check: getTask returns already-completed task
    orchestrator.getTask.mockResolvedValueOnce({
      id: TASK_ID,
      status: 'completed',
      output: 'Summary done',
    });

    await setupAutomationWorker(orchestrator as any, pino({ level: 'silent' }));
    const workerPromise = capturedWorker.processor?.({
      data: {
        runId: '550e8400-e29b-41d4-a716-446655440004',
        automationId: AUTOMATION_ID,
        userId: USER_ID,
        workspaceId: WORKSPACE_ID,
        prompt: 'Summarize',
      },
    });

    await workerPromise;

    // Safety check called once
    expect(orchestrator.getTask).toHaveBeenCalledTimes(1);
    // Worker updated: running status + taskId + completed status + lastRunAt
    expect(mockDb.update).toHaveBeenCalledTimes(4);
  });

  it('handles task completion via event emitter', async () => {
    const { setupAutomationWorker } = await import('./queue');
    const orchestrator = createMockOrchestrator();

    // Safety check returns non-terminal status
    orchestrator.getTask.mockResolvedValueOnce({
      id: TASK_ID,
      status: 'executing',
      output: null,
    });

    await setupAutomationWorker(orchestrator as any, pino({ level: 'silent' }));
    const workerPromise = capturedWorker.processor?.({
      data: {
        runId: '550e8400-e29b-41d4-a716-446655440004',
        automationId: AUTOMATION_ID,
        userId: USER_ID,
        workspaceId: WORKSPACE_ID,
        prompt: 'Summarize',
      },
    });

    // Simulate task completion event
    setTimeout(() => {
      orchestrator._emitter.emit('task', {
        status: 'completed',
        output: 'Event-driven result',
      });
    }, 10);

    await workerPromise;

    // Worker updated: running status + taskId + completed status + lastRunAt
    expect(mockDb.update).toHaveBeenCalledTimes(4);
  });
});
