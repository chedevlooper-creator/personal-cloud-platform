import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiErrorHandler } from '@pcp/shared';

const INTERNAL_TOKEN = 'test-token'.repeat(4);
process.env.INTERNAL_SERVICE_TOKEN = INTERNAL_TOKEN;

const USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440002';

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    execute: vi.fn(),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [
          {
            id: '550e8400-e29b-41d4-a716-446655440003',
            userId: '550e8400-e29b-41d4-a716-446655440001',
            workspaceId: '550e8400-e29b-41d4-a716-446655440002',
            type: 'long-term',
            content: 'memory',
            metadata: {},
            createdAt: new Date('2026-04-29T00:00:00.000Z'),
            updatedAt: new Date('2026-04-29T00:00:00.000Z'),
          },
        ]),
      })),
    })),
    query: {
      sessions: {
        findFirst: vi.fn(),
      },
      users: {
        findFirst: vi.fn(),
      },
      workspaces: {
        findFirst: vi.fn(),
      },
    },
  };
  return { mockDb };
});

vi.mock('@pcp/db/src/client', () => ({
  db: mockDb,
}));

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
  return {
    ...actual,
    and: (...conditions: unknown[]) => ({ type: 'and', conditions }),
    eq: (column: unknown, value: unknown) => ({ type: 'eq', column, value }),
    isNull: (column: unknown) => ({ type: 'isNull', column }),
  };
});

async function buildApp() {
  const { setupMemoryRoutes } = await import('./routes');
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(createApiErrorHandler());
  await setupMemoryRoutes(app);
  return app;
}

describe('memory routes workspace ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.query.users.findFirst.mockResolvedValue({ id: USER_ID });
    mockDb.query.workspaces.findFirst.mockResolvedValue({ id: WORKSPACE_ID, userId: USER_ID });
  });

  it('returns 404 when adding memory for an unowned workspace', async () => {
    const app = await buildApp();
    mockDb.query.workspaces.findFirst.mockResolvedValueOnce(null);

    const response = await app.inject({
      method: 'POST',
      url: '/memory/entries',
      headers: {
        authorization: `Bearer ${INTERNAL_TOKEN}`,
        'x-user-id': USER_ID,
      },
      payload: {
        workspaceId: WORKSPACE_ID,
        type: 'long-term',
        content: 'memory',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
    expect(mockDb.insert).not.toHaveBeenCalled();

    await app.close();
  });
});
