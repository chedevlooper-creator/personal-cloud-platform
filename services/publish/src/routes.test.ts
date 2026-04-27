import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SESSION_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const SPOOFED_USER_ID = '550e8400-e29b-41d4-a716-446655440002';
const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440003';
const SERVICE_ID = '550e8400-e29b-41d4-a716-446655440004';

const { mockDb, serviceMethods } = vi.hoisted(() => {
  const serviceMethods = {
    createService: vi.fn(),
    listServices: vi.fn(),
    updateService: vi.fn(),
    deleteService: vi.fn(),
    startService: vi.fn(),
    stopService: vi.fn(),
  };

  const mockDb = {
    query: {
      sessions: {
        findFirst: vi.fn(),
      },
    },
  };

  return { mockDb, serviceMethods };
});

vi.mock('@pcp/db/src/client', () => ({
  db: mockDb,
}));

vi.mock('./service', () => ({
  PublishService: vi.fn(() => serviceMethods),
}));

function hostedService(overrides: Record<string, unknown> = {}) {
  return {
    id: SERVICE_ID,
    userId: SESSION_USER_ID,
    workspaceId: WORKSPACE_ID,
    name: 'Site',
    slug: 'site',
    kind: 'static',
    rootPath: '/',
    startCommand: null,
    port: null,
    envVars: {},
    isPublic: false,
    autoRestart: true,
    customDomain: null,
    status: 'stopped',
    runnerProcessId: null,
    publicUrl: null,
    lastHealthAt: null,
    lastHealthOk: null,
    crashCount: 0,
    createdAt: new Date('2026-04-27T00:00:00.000Z'),
    updatedAt: new Date('2026-04-27T00:00:00.000Z'),
    ...overrides,
  };
}

async function buildApp() {
  const { publishRoutes } = await import('./routes');
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(cookie);
  await app.register(publishRoutes);
  return app;
}

describe('publish routes tenant identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.query.sessions.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: SESSION_USER_ID,
      expiresAt: new Date(Date.now() + 60_000),
    });
    serviceMethods.createService.mockResolvedValue(hostedService());
    serviceMethods.listServices.mockResolvedValue([hostedService()]);
    serviceMethods.updateService.mockResolvedValue(hostedService({ name: 'Updated' }));
    serviceMethods.deleteService.mockResolvedValue(undefined);
    serviceMethods.startService.mockResolvedValue({ status: 'starting' });
    serviceMethods.stopService.mockResolvedValue({ status: 'stopped' });
  });

  it('uses the session user when creating a hosted service', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/hosted-services',
      headers: { cookie: 'sessionId=session-1' },
      payload: {
        userId: SPOOFED_USER_ID,
        workspaceId: WORKSPACE_ID,
        name: 'Site',
        slug: 'site',
        kind: 'static',
        rootPath: '/',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(serviceMethods.createService).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: SESSION_USER_ID,
        workspaceId: WORKSPACE_ID,
      }),
    );
    expect(serviceMethods.createService).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: SPOOFED_USER_ID }),
    );

    await app.close();
  });

  it('uses the session user when listing services', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/hosted-services?workspaceId=${WORKSPACE_ID}&userId=${SPOOFED_USER_ID}`,
      headers: { cookie: 'sessionId=session-1' },
    });

    expect(response.statusCode).toBe(200);
    expect(serviceMethods.listServices).toHaveBeenCalledWith(WORKSPACE_ID, SESSION_USER_ID);

    await app.close();
  });

  it('rejects missing or expired sessions', async () => {
    const app = await buildApp();

    const missing = await app.inject({
      method: 'GET',
      url: `/hosted-services?workspaceId=${WORKSPACE_ID}`,
    });
    expect(missing.statusCode).toBe(401);

    mockDb.query.sessions.findFirst.mockResolvedValueOnce({
      id: 'session-1',
      userId: SESSION_USER_ID,
      expiresAt: new Date(Date.now() - 60_000),
    });

    const expired = await app.inject({
      method: 'GET',
      url: `/hosted-services?workspaceId=${WORKSPACE_ID}`,
      headers: { cookie: 'sessionId=session-1' },
    });
    expect(expired.statusCode).toBe(401);

    await app.close();
  });

  it('uses the session user for lifecycle operations', async () => {
    const app = await buildApp();

    await app.inject({
      method: 'POST',
      url: `/hosted-services/${SERVICE_ID}/start`,
      headers: { cookie: 'sessionId=session-1' },
      payload: { userId: SPOOFED_USER_ID },
    });
    await app.inject({
      method: 'POST',
      url: `/hosted-services/${SERVICE_ID}/stop`,
      headers: { cookie: 'sessionId=session-1' },
      payload: { userId: SPOOFED_USER_ID },
    });
    await app.inject({
      method: 'DELETE',
      url: `/hosted-services/${SERVICE_ID}?userId=${SPOOFED_USER_ID}`,
      headers: { cookie: 'sessionId=session-1' },
    });

    expect(serviceMethods.startService).toHaveBeenCalledWith(SERVICE_ID, SESSION_USER_ID);
    expect(serviceMethods.stopService).toHaveBeenCalledWith(SERVICE_ID, SESSION_USER_ID);
    expect(serviceMethods.deleteService).toHaveBeenCalledWith(SERVICE_ID, SESSION_USER_ID);

    await app.close();
  });
});
