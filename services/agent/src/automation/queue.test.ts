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
});
