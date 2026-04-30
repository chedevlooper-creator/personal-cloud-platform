import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const TASK_ID = '550e8400-e29b-41d4-a716-446655440005';
const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440003';

const { orchestratorMethods } = vi.hoisted(() => {
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
  };

  return { orchestratorMethods };
});

vi.mock('./orchestrator', () => ({
  AgentOrchestrator: vi.fn(() => orchestratorMethods),
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
  await app.register(cookie);
  await app.register(setupAgentRoutes);
  return app;
}

describe('agent task event stream routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
