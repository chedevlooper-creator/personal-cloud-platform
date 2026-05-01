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

  const mockDb: any = {
    query: {
      sessions: { findFirst: vi.fn() },
      users: { findFirst: vi.fn() },
      workspaces: { findFirst: vi.fn() },
      conversations: { findFirst: vi.fn(), findMany: vi.fn() },
      tasks: { findFirst: vi.fn(), findMany: vi.fn() },
      taskSteps: { findFirst: vi.fn(), findMany: vi.fn() },
      toolCalls: { findFirst: vi.fn(), findMany: vi.fn() },
      approvalRequests: { findFirst: vi.fn() },
      personas: { findFirst: vi.fn() },
      userPreferences: { findFirst: vi.fn() },
      providerCredentials: { findFirst: vi.fn(), findMany: vi.fn() },
      skills: { findMany: vi.fn() },
      tokenUsage: { findFirst: vi.fn() },
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
    transaction: vi.fn(async (cb: any) => cb(mockDb)),
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
    mockDb.query.taskSteps.findFirst.mockResolvedValue(null);
    mockDb.query.taskSteps.findMany.mockResolvedValue([]);
    mockDb.query.toolCalls.findMany.mockResolvedValue([]);
    mockDb.query.approvalRequests.findFirst.mockResolvedValue(null);
    mockDb.query.personas.findFirst.mockResolvedValue(null);
    mockDb.query.userPreferences.findFirst.mockResolvedValue(null);
    mockDb.query.providerCredentials.findFirst.mockResolvedValue(null);
    mockDb.query.providerCredentials.findMany.mockResolvedValue([]);
    mockDb.query.skills.findMany.mockResolvedValue([]);
    mockDb.query.tokenUsage.findFirst.mockResolvedValue(null);
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

  it('rebuilds messages correctly from task steps and allocates monotonic step numbers on resume (approve)', async () => {
    const { AgentOrchestrator } = await import('./orchestrator');
    mockDb.query.tasks.findFirst.mockImplementation(() => {
      // Simulate that after submitToolApproval updates task status, it's executing
      const hasUpdatedTask = updatedValues.some(v => v.status === 'executing');
      return Promise.resolve({
        id: TASK_ID,
        userId: USER_ID,
        workspaceId: WORKSPACE_ID,
        status: hasUpdatedTask ? 'executing' : 'waiting_approval',
        input: 'run tests',
      });
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
      expiresAt: new Date(Date.now() + 100000), // not expired
    });
    
    // Provide existing steps to simulate resume
    mockDb.query.taskSteps.findMany.mockImplementation(() => {
      return Promise.resolve([
        { type: 'thought', content: 'I should run tests', stepNumber: 1 },
        { type: 'action', toolName: 'run_command', toolInput: { command: 'npm test' }, stepNumber: 2 },
        ...insertedValues.filter(v => v.type === 'observation')
      ]);
    });
    mockDb.query.taskSteps.findFirst.mockImplementation(() => {
      const insertedSteps = insertedValues.filter(v => v.stepNumber !== undefined).map(v => v.stepNumber as number);
      const maxInserted = insertedSteps.length > 0 ? Math.max(...insertedSteps) : 0;
      return Promise.resolve({ stepNumber: Math.max(2, maxInserted) });
    });

    const executeApproved = vi.fn(async () => 'tests passed');
    const generate = vi.fn(async () => ({
      content: 'All done',
      toolCalls: [],
    }));

    const orchestrator = new AgentOrchestrator(logger) as unknown as {
      registry: { executeApproved: ReturnType<typeof vi.fn>, getAllDefinitions: () => any[] };
      llm: { generate: typeof generate };
      submitToolApproval: (
        taskId: string,
        userId: string,
        decision: 'approve' | 'reject',
        reason?: string,
      ) => Promise<void>;
    };
    orchestrator.registry = { executeApproved: executeApproved as any, getAllDefinitions: vi.fn(() => []) };
    orchestrator.llm = { generate };

    await orchestrator.submitToolApproval(TASK_ID, USER_ID, 'approve');

    // Wait for the async runAgentLoop to finish
    await new Promise((resolve) => setTimeout(resolve, 0));

    // verify step 3 was inserted for observation
    const obsStep = insertedValues.find(v => v.type === 'observation');
    expect(obsStep).toMatchObject({ stepNumber: 3, toolOutput: 'tests passed' });

    // verify step 4 was inserted for thought
    const thoughtStep = insertedValues.find(v => v.type === 'thought' && v.content === 'All done');
    expect(thoughtStep).toMatchObject({ stepNumber: 4 });

    // verify generate was called with correct messages
    const generateCall = (generate.mock.calls[0] as any)?.[0];
    expect(generateCall).toMatchObject([
      { role: 'system', content: expect.any(String) },
      { role: 'user', content: 'run tests' },
      { role: 'assistant', content: 'I should run tests' },
      { role: 'assistant', content: 'Calling tool run_command' },
      { role: 'user', content: 'tests passed', name: 'run_command' },
      { role: 'assistant', content: 'All done' },
    ]);
  });

  it('rebuilds messages correctly from task steps and allocates monotonic step numbers on resume (reject)', async () => {
    const { AgentOrchestrator } = await import('./orchestrator');
    mockDb.query.tasks.findFirst.mockImplementation(() => {
      const hasUpdatedTask = updatedValues.some(v => v.status === 'executing');
      return Promise.resolve({
        id: TASK_ID,
        userId: USER_ID,
        workspaceId: WORKSPACE_ID,
        status: hasUpdatedTask ? 'executing' : 'waiting_approval',
        input: 'run tests',
      });
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
      expiresAt: new Date(Date.now() + 100000), // not expired
    });
    
    // Provide existing steps to simulate resume
    mockDb.query.taskSteps.findMany.mockImplementation(() => {
      return Promise.resolve([
        { type: 'thought', content: 'I should run tests', stepNumber: 1 },
        { type: 'action', toolName: 'run_command', toolInput: { command: 'npm test' }, stepNumber: 2 },
        ...insertedValues.filter(v => v.type === 'observation')
      ]);
    });
    mockDb.query.taskSteps.findFirst.mockImplementation(() => {
      const insertedSteps = insertedValues.filter(v => v.stepNumber !== undefined).map(v => v.stepNumber as number);
      const maxInserted = insertedSteps.length > 0 ? Math.max(...insertedSteps) : 0;
      return Promise.resolve({ stepNumber: Math.max(2, maxInserted) });
    });

    const generate = vi.fn(async () => ({
      content: 'I will stop',
      toolCalls: [],
    }));

    const orchestrator = new AgentOrchestrator(logger) as unknown as {
      registry: { getAllDefinitions: () => any[] };
      llm: { generate: typeof generate };
      submitToolApproval: (
        taskId: string,
        userId: string,
        decision: 'approve' | 'reject',
        reason?: string,
      ) => Promise<void>;
    };
    orchestrator.registry = { getAllDefinitions: vi.fn(() => []) };
    orchestrator.llm = { generate };

    await orchestrator.submitToolApproval(TASK_ID, USER_ID, 'reject', 'Too dangerous');

    // Wait for the async runAgentLoop to finish
    await new Promise((resolve) => setTimeout(resolve, 0));

    // verify step 3 was inserted for observation (rejection)
    const obsStep = insertedValues.find(v => v.type === 'observation');
    expect(obsStep).toMatchObject({ stepNumber: 3, toolOutput: 'User rejected tool execution: Too dangerous' });

    // verify generate was called with correct messages
    const generateCall = (generate.mock.calls[0] as any)?.[0];
    expect(generateCall).toMatchObject([
      { role: 'system', content: expect.any(String) },
      { role: 'user', content: 'run tests' },
      { role: 'assistant', content: 'I should run tests' },
      { role: 'assistant', content: 'Calling tool run_command' },
      { role: 'user', content: 'User rejected tool execution: Too dangerous', name: 'run_command' },
      { role: 'assistant', content: 'I will stop' },
    ]);
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

  it('persists provider, model, token usage, and latency metadata for completed agent runs', async () => {
    const { AgentOrchestrator } = await import('./orchestrator');
    mockDb.query.tasks.findFirst.mockResolvedValue({
      id: TASK_ID,
      userId: USER_ID,
      workspaceId: WORKSPACE_ID,
      conversationId: CONVERSATION_ID,
      input: 'answer directly',
      output: null,
      status: 'pending',
      metadata: { personaId: null, skillIds: [] },
      createdAt: new Date('2026-04-27T00:00:00.000Z'),
      updatedAt: new Date('2026-04-27T00:00:00.000Z'),
    });
    const generate = vi.fn(async () => ({
      content: 'done',
      usage: {
        promptTokens: 11,
        completionTokens: 7,
        totalTokens: 18,
      },
    }));
    const orchestrator = new AgentOrchestrator(logger) as unknown as {
      llm: { generate: typeof generate };
      runAgentLoop: (taskId: string, userId: string) => Promise<void>;
    };
    orchestrator.llm = { generate };

    await orchestrator.runAgentLoop(TASK_ID, USER_ID);

    const completed = updatedValues.find((value) => value.status === 'completed');
    expect(completed).toMatchObject({
      output: 'done',
      metadata: {
        personaId: null,
        skillIds: [],
        agentRun: {
          provider: 'openai',
          model: 'gpt-4-turbo-preview',
          iterations: 1,
          usage: {
            promptTokens: 11,
            completionTokens: 7,
            totalTokens: 18,
          },
        },
      },
    });
    expect(
      (completed as { metadata?: { agentRun?: { latencyMs?: number } } }).metadata?.agentRun
        ?.latencyMs,
    ).toEqual(expect.any(Number));
  });

  it('marks the task failed and emits a terminal update when the LLM provider throws', async () => {
    // Regression: previously an uncaught provider exception left the task in
    // 'executing' with no SSE update, leaking emitter listeners and runtime
    // ids. The loop now wraps its body and routes failures through
    // failTaskFromError so subscribers see the terminal state.
    const { AgentOrchestrator } = await import('./orchestrator');
    const taskRow = {
      id: TASK_ID,
      userId: USER_ID,
      workspaceId: WORKSPACE_ID,
      conversationId: CONVERSATION_ID,
      input: 'will explode',
      output: null,
      status: 'pending',
      metadata: { personaId: null, skillIds: [] },
      createdAt: new Date('2026-04-27T00:00:00.000Z'),
      updatedAt: new Date('2026-04-27T00:00:00.000Z'),
    };
    mockDb.query.tasks.findFirst.mockResolvedValue(taskRow);

    const generate = vi.fn(async () => {
      throw new Error('upstream 503');
    });
    const emitTaskUpdate = vi.fn();
    const orchestrator = new AgentOrchestrator(logger) as unknown as {
      llm: { generate: typeof generate };
      emitTaskUpdate: typeof emitTaskUpdate;
      runAgentLoop: (taskId: string, userId: string) => Promise<void>;
    };
    orchestrator.llm = { generate };
    orchestrator.emitTaskUpdate = emitTaskUpdate;

    await expect(
      orchestrator.runAgentLoop(TASK_ID, USER_ID),
    ).resolves.toBeUndefined();

    const failed = updatedValues.find(
      (value) => value.status === 'failed' && value.output === 'upstream 503',
    );
    expect(failed).toBeDefined();
    // Terminal state must be broadcast so SSE subscribers don't hang.
    expect(emitTaskUpdate).toHaveBeenCalledWith(
      TASK_ID,
      expect.objectContaining({ id: TASK_ID }),
    );
  });

  it('stores a readable failure when provider authentication fails', async () => {
    const { AgentOrchestrator } = await import('./orchestrator');
    const taskRow = {
      id: TASK_ID,
      userId: USER_ID,
      workspaceId: WORKSPACE_ID,
      conversationId: CONVERSATION_ID,
      input: 'needs auth',
      output: null,
      status: 'pending',
      metadata: { personaId: null, skillIds: [] },
      createdAt: new Date('2026-04-27T00:00:00.000Z'),
      updatedAt: new Date('2026-04-27T00:00:00.000Z'),
    };
    mockDb.query.tasks.findFirst.mockResolvedValue(taskRow);

    const authError = new Error(
      "401 authentication_error: Please carry the API secret key in the Authorization field",
    ) as Error & { status: number };
    authError.status = 401;
    const generate = vi.fn(async () => {
      throw authError;
    });
    const orchestrator = new AgentOrchestrator(logger) as unknown as {
      llm: { generate: typeof generate };
      runAgentLoop: (taskId: string, userId: string) => Promise<void>;
    };
    orchestrator.llm = { generate };

    await expect(orchestrator.runAgentLoop(TASK_ID, USER_ID)).resolves.toBeUndefined();

    const failed = updatedValues.find(
      (value) =>
        value.status === 'failed' &&
        value.output ===
          'AI provider authentication failed. Add a valid key in Settings > AI Providers, ' +
            'or set the service API key for the selected provider and restart the agent service.',
    );
    expect(failed).toBeDefined();
  });

  it('executes multiple tool calls in a single LLM response', async () => {
    const { AgentOrchestrator } = await import('./orchestrator');
    mockDb.query.tasks.findFirst.mockResolvedValue({
      id: TASK_ID,
      userId: USER_ID,
      workspaceId: WORKSPACE_ID,
      conversationId: CONVERSATION_ID,
      input: 'read and list',
      output: null,
      status: 'pending',
      metadata: { personaId: null, skillIds: [] },
      createdAt: new Date('2026-04-27T00:00:00.000Z'),
      updatedAt: new Date('2026-04-27T00:00:00.000Z'),
    });

    const generate = vi.fn(async () => {
      // First call returns tool calls; subsequent calls return completion
      if (generate.mock.calls.length > 1) {
        return { content: 'All done', toolCalls: [] };
      }
      return {
        content: null,
        toolCalls: [
          { id: 'tc-1', name: 'read_file', arguments: JSON.stringify({ path: '/README.md' }) },
          { id: 'tc-2', name: 'list_files', arguments: JSON.stringify({ path: '/' }) },
        ],
      };
    });

    const execute = vi.fn(async (name: string) => {
      if (name === 'read_file') return 'Hello world';
      if (name === 'list_files') return JSON.stringify(['a.ts', 'b.ts']);
      throw new Error('unknown');
    });

    const orchestrator = new AgentOrchestrator(logger) as unknown as {
      llm: { generate: typeof generate };
      registry: {
        execute: typeof execute;
        getAllDefinitions: () => any[];
        get: (name: string) => { requiresApproval: boolean } | undefined;
      };
      runAgentLoop: (taskId: string, userId: string) => Promise<void>;
    };
    orchestrator.llm = { generate };
    orchestrator.registry = {
      execute,
      getAllDefinitions: vi.fn(() => []),
      get: () => ({ requiresApproval: false }),
    };

    await orchestrator.runAgentLoop(TASK_ID, USER_ID);

    // Both tools should have been executed
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenCalledWith(
      'read_file',
      JSON.stringify({ path: '/README.md' }),
      expect.anything(),
    );
    expect(execute).toHaveBeenCalledWith(
      'list_files',
      JSON.stringify({ path: '/' }),
      expect.anything(),
    );

    // Should mark task completed after the second LLM call returns no tools
    expect(updatedValues.some((v) => v.status === 'completed')).toBe(true);
  });

  it('pauses on approval even when multiple tools are requested', async () => {
    const { AgentOrchestrator } = await import('./orchestrator');
    mockDb.query.tasks.findFirst.mockResolvedValue({
      id: TASK_ID,
      userId: USER_ID,
      workspaceId: WORKSPACE_ID,
      conversationId: CONVERSATION_ID,
      input: 'run dangerous cmd',
      output: null,
      status: 'pending',
      metadata: { personaId: null, skillIds: [] },
      createdAt: new Date('2026-04-27T00:00:00.000Z'),
      updatedAt: new Date('2026-04-27T00:00:00.000Z'),
    });

    const generate = vi.fn(async () => ({
      content: null,
      toolCalls: [
        { id: 'tc-1', name: 'read_file', arguments: JSON.stringify({ path: '/x' }) },
        { id: 'tc-2', name: 'run_command', arguments: JSON.stringify({ command: 'rm -rf /' }) },
      ],
    }));

    const execute = vi.fn(async () => 'file content');

    const orchestrator = new AgentOrchestrator(logger) as unknown as {
      llm: { generate: typeof generate };
      registry: {
        execute: typeof execute;
        getAllDefinitions: () => any[];
        get: (name: string) => { requiresApproval: boolean } | undefined;
      };
      runAgentLoop: (taskId: string, userId: string) => Promise<void>;
    };
    orchestrator.llm = { generate };
    orchestrator.registry = {
      execute,
      getAllDefinitions: vi.fn(() => []),
      get: (name: string) =>
        name === 'run_command' ? { requiresApproval: true } : { requiresApproval: false },
    };

    await orchestrator.runAgentLoop(TASK_ID, USER_ID);

    // run_command requires approval — loop should pause immediately
    // and NOT execute any tools (even read_file)
    expect(execute).not.toHaveBeenCalled();
    expect(updatedValues.some((v) => v.status === 'waiting_approval')).toBe(true);
  });
});
