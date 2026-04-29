import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { validatorCompiler } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const AUTOMATION_ID = '550e8400-e29b-41d4-a716-446655440002';
const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440003';

const { mockDb, updateReturning, deleteWhere, insertReturning, automationQueue } = vi.hoisted(
  () => {
    const updateReturning = vi.fn();
    const deleteWhere = vi.fn();
    const insertReturning = vi.fn();

    const mockDb = {
      query: {
        sessions: {
          findFirst: vi.fn(),
        },
        users: {
          findFirst: vi.fn(),
        },
        automations: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        automationRuns: {
          findMany: vi.fn(),
        },
        workspaces: {
          findFirst: vi.fn(),
        },
      },
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: updateReturning,
          })),
        })),
      })),
      delete: vi.fn(() => ({
        where: deleteWhere,
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: insertReturning,
        })),
      })),
    };

    const automationQueue = {
      add: vi.fn(),
      removeRepeatableByKey: vi.fn(),
    };

    return { mockDb, updateReturning, deleteWhere, insertReturning, automationQueue };
  },
);

vi.mock('@pcp/db/src/client', () => ({
  db: mockDb,
}));

vi.mock('../automation/queue', () => ({
  automationQueue,
}));

function automation() {
  return {
    id: AUTOMATION_ID,
    userId: USER_ID,
    workspaceId: WORKSPACE_ID,
    title: 'Daily report',
    prompt: 'Summarize',
    scheduleType: 'manual',
    cronExpression: null,
  };
}

async function buildApp() {
  const { setupAutomationRoutes } = await import('./automation');
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  await app.register(cookie);
  await setupAutomationRoutes(app);
  return app;
}

describe('automation route tenant scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.query.sessions.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: USER_ID,
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockDb.query.users.findFirst.mockResolvedValue({ id: USER_ID });
    mockDb.query.automations.findFirst.mockResolvedValue(automation());
    mockDb.query.automations.findMany.mockResolvedValue([automation()]);
    mockDb.query.automationRuns.findMany.mockResolvedValue([]);
    mockDb.query.workspaces.findFirst.mockResolvedValue({ id: WORKSPACE_ID, userId: USER_ID });
    updateReturning.mockResolvedValue([automation()]);
    deleteWhere.mockResolvedValue(undefined);
    insertReturning.mockResolvedValue([
      {
        id: '550e8400-e29b-41d4-a716-446655440004',
        automationId: AUTOMATION_ID,
        userId: USER_ID,
        trigger: 'manual',
        status: 'queued',
      },
    ]);
  });

  it('rejects missing and expired sessions', async () => {
    const app = await buildApp();

    const missing = await app.inject({ method: 'GET', url: '/automations' });
    expect(missing.statusCode).toBe(401);

    mockDb.query.sessions.findFirst.mockResolvedValueOnce({
      id: 'session-1',
      userId: USER_ID,
      expiresAt: new Date(Date.now() - 60_000),
    });

    const expired = await app.inject({
      method: 'GET',
      url: '/automations',
      headers: { cookie: 'sessionId=session-1' },
    });
    expect(expired.statusCode).toBe(401);

    await app.close();
  });

  it('returns 404 when update does not find an owned automation', async () => {
    const app = await buildApp();
    updateReturning.mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'PATCH',
      url: `/automations/${AUTOMATION_ID}`,
      headers: { cookie: 'sessionId=session-1' },
      payload: { enabled: false },
    });

    expect(response.statusCode).toBe(404);
    expect(automationQueue.removeRepeatableByKey).not.toHaveBeenCalled();

    await app.close();
  });

  it('does not enqueue a manual run for an unowned automation', async () => {
    const app = await buildApp();
    mockDb.query.automations.findFirst.mockResolvedValueOnce(null);

    const response = await app.inject({
      method: 'POST',
      url: `/automations/${AUTOMATION_ID}/run`,
      headers: { cookie: 'sessionId=session-1' },
    });

    expect(response.statusCode).toBe(404);
    expect(automationQueue.add).not.toHaveBeenCalled();

    await app.close();
  });

  it('queues manual runs with the authenticated user id after ownership lookup', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: `/automations/${AUTOMATION_ID}/run`,
      headers: { cookie: 'sessionId=session-1' },
    });

    expect(response.statusCode).toBe(200);
    expect(automationQueue.add).toHaveBeenCalledWith(
      'manual-run',
      expect.objectContaining({
        automationId: AUTOMATION_ID,
        userId: USER_ID,
        workspaceId: WORKSPACE_ID,
      }),
    );

    await app.close();
  });

  it('does not enqueue a manual run for an automation with an unowned workspace', async () => {
    const app = await buildApp();
    mockDb.query.workspaces.findFirst.mockResolvedValueOnce(null);

    const response = await app.inject({
      method: 'POST',
      url: `/automations/${AUTOMATION_ID}/run`,
      headers: { cookie: 'sessionId=session-1' },
    });

    expect(response.statusCode).toBe(404);
    expect(automationQueue.add).not.toHaveBeenCalled();

    await app.close();
  });

  it('rejects automation creation for an unowned workspace', async () => {
    const app = await buildApp();
    mockDb.query.workspaces.findFirst.mockResolvedValueOnce(null);

    const response = await app.inject({
      method: 'POST',
      url: '/automations',
      headers: { cookie: 'sessionId=session-1' },
      payload: {
        workspaceId: WORKSPACE_ID,
        title: 'Bad workspace',
        prompt: 'Summarize',
        scheduleType: 'manual',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(insertReturning).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns 404 for run history when the automation is not owned', async () => {
    const app = await buildApp();
    mockDb.query.automations.findFirst.mockResolvedValueOnce(null);

    const response = await app.inject({
      method: 'GET',
      url: `/automations/${AUTOMATION_ID}/runs`,
      headers: { cookie: 'sessionId=session-1' },
    });

    expect(response.statusCode).toBe(404);
    expect(mockDb.query.automationRuns.findMany).not.toHaveBeenCalled();

    await app.close();
  });
});
