import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    const orchestrator = {
      createTask: vi.fn(async () => ({ id: TASK_ID })),
    };

    await setupAutomationWorker(orchestrator as any, pino({ level: 'silent' }));
    await capturedWorker.processor?.({ data: { automationId: AUTOMATION_ID } });

    expect(mockDb.query.automations.findFirst).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
    expect(orchestrator.createTask).toHaveBeenCalledWith(USER_ID, WORKSPACE_ID, 'Summarize');
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('does not run scheduled automations for unowned workspaces', async () => {
    const { setupAutomationWorker } = await import('./queue');
    const orchestrator = {
      createTask: vi.fn(async () => ({ id: TASK_ID })),
    };
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
    const orchestrator = {
      createTask: vi.fn(async () => ({ id: TASK_ID })),
    };
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

  it('polls for task completion and updates run status when task finishes', async () => {
    vi.useFakeTimers();
    const { setupAutomationWorker } = await import('./queue');
    const orchestrator = {
      createTask: vi.fn(async () => ({ id: TASK_ID })),
      getTask: vi.fn()
        .mockResolvedValueOnce({ id: TASK_ID, status: 'executing', output: null })
        .mockResolvedValueOnce({ id: TASK_ID, status: 'completed', output: 'Summary done' }),
    };

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

    // Advance timers past the 3-second poll interval
    await vi.advanceTimersByTimeAsync(3500);
    await workerPromise;

    // Worker polled getTask twice (executing → completed)
    expect(orchestrator.getTask).toHaveBeenCalledTimes(2);
    // Worker updated the run record at least twice (running status + completed status)
    expect(mockDb.update).toHaveBeenCalledTimes(4);

    vi.useRealTimers();
  });
});
