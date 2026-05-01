import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { createApiErrorHandler } from '@pcp/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const TASK_ID = '550e8400-e29b-41d4-a716-446655440005';
const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440003';

const { orchestratorMethods, dbSelect, dbUserPreferencesFindFirst, dbGroupBy } = vi.hoisted(() => {
  const dbGroupBy = vi.fn(async () => []);
  const dbWhere = vi.fn(() => ({ groupBy: dbGroupBy }));
  const dbFrom = vi.fn(() => ({ where: dbWhere }));
  const dbSelect = vi.fn(() => ({ from: dbFrom }));
  const dbUserPreferencesFindFirst = vi.fn(async () => ({ monthlyTokenQuota: 100_000 }));
  const orchestratorMethods = {
    recoverInterruptedWork: vi.fn(async () => undefined),
    validateUserFromCookie: vi.fn(),
    chat: vi.fn(),
    createTask: vi.fn(),
    getTask: vi.fn(),
    getTaskSteps: vi.fn(),
    cancelTask: vi.fn(),
    getConversations: vi.fn(),
    getMessages: vi.fn(),
    submitToolApproval: vi.fn(),
    deleteConversation: vi.fn(),
    subscribeToTask: vi.fn(),
  };

  return { orchestratorMethods, dbSelect, dbUserPreferencesFindFirst, dbGroupBy };
});

vi.mock('./orchestrator', () => ({
  AgentOrchestrator: vi.fn(() => orchestratorMethods),
}));

vi.mock('@pcp/db/src/client', () => ({
  db: {
    select: dbSelect,
    query: {
      userPreferences: {
        findFirst: dbUserPreferencesFindFirst,
      },
    },
  },
}));

vi.mock('./env', () => ({
  env: {
    AUTH_BYPASS: false,
    REDIS_URL: 'redis://localhost:6379',
  },
}));

const OTHER_USER_ID = '550e8400-e29b-41d4-a716-446655440002';

vi.mock('@pcp/db/src/session', () => ({
  validateSessionUserId: vi.fn(async (sessionId: string) => {
    if (sessionId === 'session-1') return USER_ID;
    if (sessionId === 'session-2') return OTHER_USER_ID;
    return null;
  }),
}));

async function buildApp() {
  const { setupAgentRoutes } = await import('./routes');
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(createApiErrorHandler());
  await app.register(cookie);
  await app.register(setupAgentRoutes);
  return app;
}

describe('agent task event stream routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbGroupBy.mockResolvedValue([]);
    dbUserPreferencesFindFirst.mockResolvedValue({ monthlyTokenQuota: 100_000 });
    orchestratorMethods.recoverInterruptedWork.mockResolvedValue(undefined);
    orchestratorMethods.validateUserFromCookie.mockResolvedValue(USER_ID);
    orchestratorMethods.getTask.mockResolvedValue({
      id: TASK_ID,
      userId: USER_ID,
      workspaceId: WORKSPACE_ID,
      status: 'executing',
      input: 'hello',
      output: null,
      createdAt: new Date('2026-04-27T00:00:00.000Z'),
      updatedAt: new Date('2026-04-27T00:00:00.000Z'),
    });
    orchestratorMethods.getTaskSteps.mockResolvedValue([
      {
        id: '550e8400-e29b-41d4-a716-446655440006',
        taskId: TASK_ID,
        stepNumber: 1,
        type: 'thought',
        content: 'Working',
        toolName: null,
        toolInput: null,
        toolOutput: null,
        createdAt: new Date('2026-04-27T00:00:01.000Z'),
      },
    ]);
    orchestratorMethods.subscribeToTask.mockReturnValue({
      on: vi.fn((event: string, callback: (data: unknown) => void) => {
        if (event === 'task') {
          callback({
            id: TASK_ID,
            userId: USER_ID,
            workspaceId: WORKSPACE_ID,
            status: 'completed',
            input: 'hello',
            output: 'done',
            createdAt: new Date('2026-04-27T00:00:00.000Z'),
            updatedAt: new Date('2026-04-27T00:00:02.000Z'),
          });
        }
      }),
      off: vi.fn(),
    });
  });

  it('rejects unauthenticated task event stream requests', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/agent/tasks/${TASK_ID}/events?snapshot=true`,
    });

    expect(response.statusCode).toBe(401);
    expect(orchestratorMethods.getTask).not.toHaveBeenCalled();

    await app.close();
  });

  it('streams a task and step snapshot as server-sent events for the owning user', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/agent/tasks/${TASK_ID}/events?snapshot=true`,
      headers: { cookie: 'sessionId=session-1' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.body).toContain('event: task');
    expect(response.body).toContain('event: step');
    expect(response.body).toContain('"status":"executing"');
    expect(response.body).toContain('"content":"Working"');
    expect(orchestratorMethods.getTask).toHaveBeenCalledWith(TASK_ID, USER_ID);
    expect(orchestratorMethods.getTaskSteps).toHaveBeenCalledWith(TASK_ID, USER_ID);

    await app.close();
  });

  it('does not stream task data when a different user tries to access the event stream', async () => {
    const app = await buildApp();

    // getTask returns null for the other user, simulating tenant isolation
    orchestratorMethods.getTask.mockResolvedValueOnce(null);

    const response = await app.inject({
      method: 'GET',
      url: `/agent/tasks/${TASK_ID}/events?snapshot=true`,
      headers: { cookie: 'sessionId=session-2' },
    });

    // SSE opens 200 immediately; tenant isolation is enforced by omitting data.
    expect(response.statusCode).toBe(200);
    expect(orchestratorMethods.getTask).toHaveBeenCalledWith(TASK_ID, OTHER_USER_ID);
    expect(response.body).not.toContain('event: task');

    await app.close();
  });

  it('rejects live event streams before subscribing when the task is not owned by the user', async () => {
    const app = await buildApp();

    orchestratorMethods.getTask.mockResolvedValueOnce(null);

    const response = await app.inject({
      method: 'GET',
      url: `/agent/tasks/${TASK_ID}/events`,
      headers: { cookie: 'sessionId=session-2' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
    expect(orchestratorMethods.getTask).toHaveBeenCalledWith(TASK_ID, OTHER_USER_ID);
    expect(orchestratorMethods.subscribeToTask).not.toHaveBeenCalled();

    await app.close();
  });

  it('streams and closes an already terminal owned live task without subscribing', async () => {
    const app = await buildApp();

    orchestratorMethods.getTask.mockResolvedValueOnce({
      id: TASK_ID,
      userId: USER_ID,
      workspaceId: WORKSPACE_ID,
      status: 'completed',
      input: 'hello',
      output: 'done',
      createdAt: new Date('2026-04-27T00:00:00.000Z'),
      updatedAt: new Date('2026-04-27T00:00:02.000Z'),
    });

    const response = await app.inject({
      method: 'GET',
      url: `/agent/tasks/${TASK_ID}/events`,
      headers: { cookie: 'sessionId=session-1' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.body).toContain('event: task');
    expect(response.body).toContain('"status":"completed"');
    expect(response.body).toContain('"output":"done"');
    expect(orchestratorMethods.getTask).toHaveBeenCalledWith(TASK_ID, USER_ID);
    expect(orchestratorMethods.subscribeToTask).not.toHaveBeenCalled();

    await app.close();
  });

  it('subscribes and sends fresh current state for owned active live streams', async () => {
    const app = await buildApp();

    const staleTask = {
      id: TASK_ID,
      userId: USER_ID,
      workspaceId: WORKSPACE_ID,
      status: 'executing',
      input: 'hello',
      output: 'stale',
      createdAt: new Date('2026-04-27T00:00:00.000Z'),
      updatedAt: new Date('2026-04-27T00:00:01.000Z'),
    };
    const freshTask = {
      ...staleTask,
      output: 'fresh current',
      updatedAt: new Date('2026-04-27T00:00:02.000Z'),
    };
    const completedTask = {
      ...freshTask,
      status: 'completed',
      output: 'done',
      updatedAt: new Date('2026-04-27T00:00:03.000Z'),
    };
    let taskListener: ((data: unknown) => void) | undefined;
    const emitter = {
      on: vi.fn((event: string, callback: (data: unknown) => void) => {
        if (event === 'task') {
          taskListener = callback;
        }
        if (event === 'step') {
          setImmediate(() => taskListener?.(completedTask));
        }
      }),
      off: vi.fn(),
    };

    orchestratorMethods.getTask.mockResolvedValueOnce(staleTask).mockResolvedValueOnce(freshTask);
    orchestratorMethods.subscribeToTask.mockReturnValueOnce(emitter);

    const response = await app.inject({
      method: 'GET',
      url: `/agent/tasks/${TASK_ID}/events`,
      headers: { cookie: 'sessionId=session-1' },
    });

    const freshIndex = response.body.indexOf('"output":"fresh current"');
    const completedIndex = response.body.indexOf('"output":"done"');

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(orchestratorMethods.getTask).toHaveBeenNthCalledWith(1, TASK_ID, USER_ID);
    expect(orchestratorMethods.getTask).toHaveBeenNthCalledWith(2, TASK_ID, USER_ID);
    expect(orchestratorMethods.subscribeToTask).toHaveBeenCalledWith(TASK_ID);
    expect(emitter.on).toHaveBeenCalledWith('task', expect.any(Function));
    expect(emitter.on).toHaveBeenCalledWith('step', expect.any(Function));
    expect(response.body).not.toContain('"output":"stale"');
    expect(freshIndex).toBeGreaterThanOrEqual(0);
    expect(completedIndex).toBeGreaterThan(freshIndex);

    await app.close();
  });
});
