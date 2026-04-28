import { beforeEach, describe, it, expect, vi } from 'vitest';
import pino from 'pino';

const USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const OTHER_USER_ID = '550e8400-e29b-41d4-a716-446655440002';
const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440003';
const CONVERSATION_ID = '550e8400-e29b-41d4-a716-446655440004';

const { mockDb } = vi.hoisted(() => {
  const insertReturning = vi.fn(async () => [
    {
      id: '550e8400-e29b-41d4-a716-446655440005',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      workspaceId: '550e8400-e29b-41d4-a716-446655440003',
      conversationId: '550e8400-e29b-41d4-a716-446655440004',
      input: 'hello',
      output: null,
      status: 'pending',
      createdAt: new Date('2026-04-27T00:00:00.000Z'),
      updatedAt: new Date('2026-04-27T00:00:00.000Z'),
    },
  ]);

  const mockDb = {
    query: {
      sessions: { findFirst: vi.fn() },
      users: { findFirst: vi.fn() },
      workspaces: { findFirst: vi.fn() },
      conversations: { findFirst: vi.fn(), findMany: vi.fn() },
      tasks: { findFirst: vi.fn(), findMany: vi.fn() },
      taskSteps: { findMany: vi.fn() },
      toolCalls: { findFirst: vi.fn() },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: insertReturning,
        execute: vi.fn(async () => undefined),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          execute: vi.fn(async () => undefined),
        })),
      })),
    })),
  };

  return { mockDb };
});

vi.mock('@pcp/db/src/client', () => ({
  db: mockDb,
}));

describe('AgentOrchestrator', () => {
  const logger = pino({ level: 'silent' });

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.query.workspaces.findFirst.mockResolvedValue({ id: WORKSPACE_ID, userId: USER_ID });
    mockDb.query.conversations.findFirst.mockResolvedValue({
      id: CONVERSATION_ID,
      userId: USER_ID,
      workspaceId: WORKSPACE_ID,
    });
    mockDb.query.tasks.findMany.mockResolvedValue([]);
    mockDb.query.taskSteps.findMany.mockResolvedValue([]);
  });

  it('should initialize successfully', async () => {
    const { AgentOrchestrator } = await import('./orchestrator');

    const orchestrator = new AgentOrchestrator(logger);
    expect(orchestrator).toBeDefined();
  });

  it('should initialize MiniMax Token Plan provider from environment', async () => {
    const { createLLMProvider } = await import('./llm/provider');
    const provider = createLLMProvider({
      LLM_PROVIDER: 'minimax',
      MINIMAX_TOKEN_PLAN_API_KEY: 'test-key',
    } as NodeJS.ProcessEnv);

    expect(provider).toBeDefined();
  });

  it('rejects a task that references an unowned conversation', async () => {
    const { AgentOrchestrator } = await import('./orchestrator');
    mockDb.query.conversations.findFirst.mockResolvedValueOnce(null);
    const orchestrator = new AgentOrchestrator(logger);

    await expect(
      orchestrator.createTask(USER_ID, WORKSPACE_ID, 'hello', CONVERSATION_ID),
    ).rejects.toThrow('Conversation not found');
  });

  it('does not return tasks from another user when loading conversation messages', async () => {
    const { AgentOrchestrator } = await import('./orchestrator');
    mockDb.query.tasks.findMany.mockResolvedValueOnce([
      {
        id: 'owned-task',
        userId: USER_ID,
        conversationId: CONVERSATION_ID,
        input: 'owned',
        output: null,
        status: 'pending',
        createdAt: new Date('2026-04-27T00:00:00.000Z'),
        updatedAt: new Date('2026-04-27T00:00:00.000Z'),
      },
      {
        id: 'other-task',
        userId: OTHER_USER_ID,
        conversationId: CONVERSATION_ID,
        input: 'other',
        output: null,
        status: 'pending',
        createdAt: new Date('2026-04-27T00:00:00.000Z'),
        updatedAt: new Date('2026-04-27T00:00:00.000Z'),
      },
    ]);
    const orchestrator = new AgentOrchestrator(logger);

    const messages = await orchestrator.getMessages(CONVERSATION_ID, USER_ID);

    expect(messages.map((message) => message.taskId)).toEqual(['owned-task']);
  });

  it('runAgentLoop bails out when the task does not belong to the caller', async () => {
    const { AgentOrchestrator } = await import('./orchestrator');
    // Simulate a tenant-scoped lookup miss: the task exists but is owned by a
    // different user, so the userId-filtered findFirst returns null.
    mockDb.query.tasks.findFirst.mockResolvedValue(null);
    const orchestrator = new AgentOrchestrator(logger);

    await (orchestrator as unknown as {
      runAgentLoop: (taskId: string, userId: string) => Promise<void>;
    }).runAgentLoop('550e8400-e29b-41d4-a716-446655440099', USER_ID);

    // The user-scoped lookup returned no row, so we must not transition the task
    // to "executing" or write any steps for it.
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});
