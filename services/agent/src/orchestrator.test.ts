import { beforeEach, describe, it, expect, vi } from 'vitest';
import pino from 'pino';

const USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const OTHER_USER_ID = '550e8400-e29b-41d4-a716-446655440002';
const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440003';
const CONVERSATION_ID = '550e8400-e29b-41d4-a716-446655440004';
const TASK_ID = '550e8400-e29b-41d4-a716-446655440005';
const TOOL_CALL_ID = '550e8400-e29b-41d4-a716-446655440006';
const APPROVAL_ID = '550e8400-e29b-41d4-a716-446655440007';

const { mockDb, insertedValues, updatedValues } = vi.hoisted(() => {
  const insertedValues: Record<string, unknown>[] = [];
  const updatedValues: Record<string, unknown>[] = [];
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
      toolCalls: { findFirst: vi.fn(), findMany: vi.fn() },
      approvalRequests: { findFirst: vi.fn() },
      personas: { findFirst: vi.fn() },
      userPreferences: { findFirst: vi.fn() },
      providerCredentials: { findFirst: vi.fn() },
      skills: { findMany: vi.fn() },
    },
    insert: vi.fn(() => ({
      values: vi.fn((value: Record<string, unknown>) => {
        insertedValues.push(value);
        return {
          returning: vi.fn(async () => {
            if ('toolCallId' in value) return [{ id: APPROVAL_ID, ...value }];
            if ('toolName' in value && 'args' in value) return [{ id: TOOL_CALL_ID, ...value }];
            return insertReturning();
          }),
          execute: vi.fn(async () => undefined),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((value: Record<string, unknown>) => {
        updatedValues.push(value);
        return {
          where: vi.fn(() => ({
            execute: vi.fn(async () => undefined),
          })),
        };
      }),
    })),
  };

  return { mockDb, insertedValues, updatedValues };
});

vi.mock('@pcp/db/src/client', () => ({
  db: mockDb,
}));

describe('AgentOrchestrator', () => {
  const logger = pino({ level: 'silent' });

  beforeEach(() => {
    vi.clearAllMocks();
    insertedValues.length = 0;
    updatedValues.length = 0;
    mockDb.query.workspaces.findFirst.mockResolvedValue({ id: WORKSPACE_ID, userId: USER_ID });
    mockDb.query.conversations.findFirst.mockResolvedValue({
      id: CONVERSATION_ID,
      userId: USER_ID,
      workspaceId: WORKSPACE_ID,
    });
    mockDb.query.tasks.findMany.mockResolvedValue([]);
    mockDb.query.taskSteps.findMany.mockResolvedValue([]);
    mockDb.query.toolCalls.findMany.mockResolvedValue([]);
    mockDb.query.approvalRequests.findFirst.mockResolvedValue(null);
    mockDb.query.personas.findFirst.mockResolvedValue(null);
    mockDb.query.userPreferences.findFirst.mockResolvedValue(null);
    mockDb.query.providerCredentials.findFirst.mockResolvedValue(null);
    mockDb.query.skills.findMany.mockResolvedValue([]);
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

    await (
      orchestrator as unknown as {
        runAgentLoop: (taskId: string, userId: string) => Promise<void>;
      }
    ).runAgentLoop('550e8400-e29b-41d4-a716-446655440099', USER_ID);

    // The user-scoped lookup returned no row, so we must not transition the task
    // to "executing" or write any steps for it.
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('creates an expiring approval request for approval-required tool calls', async () => {
    const { AgentOrchestrator } = await import('./orchestrator');
    mockDb.query.tasks.findFirst.mockResolvedValue({
      id: TASK_ID,
      userId: USER_ID,
      workspaceId: WORKSPACE_ID,
      conversationId: CONVERSATION_ID,
      input: 'run tests',
      output: null,
      status: 'pending',
      metadata: null,
      createdAt: new Date('2026-04-27T00:00:00.000Z'),
      updatedAt: new Date('2026-04-27T00:00:00.000Z'),
    });
    const generate = vi.fn(async () => ({
      content: null,
      toolCalls: [
        {
          id: 'provider-call-1',
          name: 'run_command',
          arguments: JSON.stringify({ command: 'npm test' }),
        },
      ],
    }));
    const orchestrator = new AgentOrchestrator(logger) as unknown as {
      llm: { generate: typeof generate };
      runAgentLoop: (taskId: string, userId: string) => Promise<void>;
    };
    orchestrator.llm = { generate };

    await orchestrator.runAgentLoop(TASK_ID, USER_ID);

    const approval = insertedValues.find((value) => value.toolCallId === TOOL_CALL_ID);
    expect(approval).toMatchObject({
      userId: USER_ID,
      taskId: TASK_ID,
      toolCallId: TOOL_CALL_ID,
      toolName: 'run_command',
      args: { command: 'npm test' },
      decision: null,
    });
    expect(approval?.expiresAt).toBeInstanceOf(Date);
    expect(updatedValues.some((value) => value.approvalId === APPROVAL_ID)).toBe(true);
    expect(insertedValues.some((value) => value.action === 'TOOL_APPROVAL_REQUESTED')).toBe(true);
  });

  it('does not execute tools after approval expiry', async () => {
    const { AgentOrchestrator } = await import('./orchestrator');
    mockDb.query.tasks.findFirst.mockResolvedValue({
      id: TASK_ID,
      userId: USER_ID,
      workspaceId: WORKSPACE_ID,
      status: 'waiting_approval',
    });
    mockDb.query.toolCalls.findFirst.mockResolvedValue({
      id: TOOL_CALL_ID,
      userId: USER_ID,
      taskId: TASK_ID,
      toolName: 'run_command',
      args: { command: 'npm test' },
      status: 'awaiting_approval',
      approvalId: APPROVAL_ID,
    });
    mockDb.query.approvalRequests.findFirst.mockResolvedValue({
      id: APPROVAL_ID,
      userId: USER_ID,
      taskId: TASK_ID,
      toolCallId: TOOL_CALL_ID,
      expiresAt: new Date('2026-04-27T00:00:00.000Z'),
    });
    const executeApproved = vi.fn();
    const orchestrator = new AgentOrchestrator(logger) as unknown as {
      registry: { executeApproved: ReturnType<typeof vi.fn> };
      submitToolApproval: (
        taskId: string,
        userId: string,
        decision: 'approve' | 'reject',
        reason?: string,
      ) => Promise<void>;
    };
    orchestrator.registry = { executeApproved };

    await expect(orchestrator.submitToolApproval(TASK_ID, USER_ID, 'approve')).rejects.toThrow(
      'Tool approval expired',
    );

    expect(executeApproved).not.toHaveBeenCalled();
    expect(updatedValues.some((value) => value.decision === 'expired')).toBe(true);
    expect(updatedValues.some((value) => value.status === 'timeout')).toBe(true);
    expect(insertedValues.some((value) => value.action === 'TOOL_APPROVAL_EXPIRED')).toBe(true);
  });

  it('marks abandoned executing tasks and running tool calls failed during recovery', async () => {
    const { AgentOrchestrator } = await import('./orchestrator');
    mockDb.query.tasks.findMany.mockResolvedValueOnce([
      {
        id: TASK_ID,
        userId: USER_ID,
        status: 'executing',
      },
    ]);
    mockDb.query.toolCalls.findMany.mockResolvedValueOnce([
      {
        id: TOOL_CALL_ID,
        userId: USER_ID,
        taskId: TASK_ID,
        status: 'running',
      },
    ]);
    const orchestrator = new AgentOrchestrator(logger) as unknown as {
      recoverInterruptedWork: () => Promise<void>;
    };

    await orchestrator.recoverInterruptedWork();

    expect(
      updatedValues.some(
        (value) =>
          value.status === 'failed' &&
          String(value.output ?? '').includes('interrupted before completion'),
      ),
    ).toBe(true);
    expect(
      updatedValues.some(
        (value) =>
          value.status === 'failed' &&
          String(value.error ?? '').includes('interrupted before completion'),
      ),
    ).toBe(true);
    expect(insertedValues.some((value) => value.action === 'AGENT_TASK_RECOVERED_FAILED')).toBe(
      true,
    );
    expect(insertedValues.some((value) => value.action === 'TOOL_CALL_RECOVERED_FAILED')).toBe(
      true,
    );
  });
});
