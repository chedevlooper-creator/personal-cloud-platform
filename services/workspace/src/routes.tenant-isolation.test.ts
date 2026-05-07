import cookie from '@fastify/cookie';
import { workspaces } from '@pcp/db/src/schema';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupWorkspaceRoutes } from './routes';

const ATTACKER_USER_ID = '550e8400-e29b-41d4-a716-4466554400aa';
const VICTIM_USER_ID = '550e8400-e29b-41d4-a716-4466554400bb';
const VICTIM_WORKSPACE_ID = '550e8400-e29b-41d4-a716-4466554400cc';
const FORGED_JWT = 'forged.header.payload';

const { mockDb, fetchMock } = vi.hoisted(() => {
  const mockDb = {
    query: {
      workspaces: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      workspaceFiles: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      snapshots: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => []),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => []),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(),
    })),
  };
  const fetchMock = vi.fn();
  return { mockDb, fetchMock };
});

vi.mock('@pcp/db/src/client', () => ({
  db: mockDb,
}));

vi.mock('@pcp/db/src/session', () => ({
  validateSessionUserId: vi.fn(),
  verifyUserExists: vi.fn(),
  upsertExternalAuthUser: vi.fn(async (user: { id: string }) => user.id),
}));

vi.mock('drizzle-orm', () => ({
  and: (...conditions: unknown[]) => ({ type: 'and', conditions }),
  desc: (column: unknown) => ({ type: 'desc', column }),
  eq: (column: unknown, value: unknown) => ({ type: 'eq', column, value }),
  isNull: (column: unknown) => ({ type: 'isNull', column }),
}));

vi.mock('./cache', () => ({
  cache: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
  },
}));

vi.mock('./env', () => ({
  env: {
    INTERNAL_SERVICE_TOKEN: 'internal-service-token',
    ALLOWED_AUDIENCES: ['agent', 'runtime', 'publish'],
    AUTH_BYPASS: false,
    S3_BUCKET: 'pcp-workspace-test',
    S3_REGION: 'us-east-1',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_ACCESS_KEY: 'minioadmin',
    S3_SECRET_KEY: 'minioadmin123',
    DATASETS_DATA_DIR: './data/datasets-test',
    REDIS_URL: 'redis://localhost:6379',
  },
}));

vi.mock('./routes/snapshots', () => ({
  setupSnapshotRoutes: vi.fn(async () => undefined),
}));

vi.mock('./routes/datasets', () => ({
  setupDatasetsRoutes: vi.fn(async () => undefined),
}));

describe('workspace route tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key');
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: ATTACKER_USER_ID, email: 'attacker@example.com' }),
    });
    mockDb.query.workspaces.findFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects forged JWT cross-tenant workspace access', async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(cookie);
    await setupWorkspaceRoutes(app);

    const response = await app.inject({
      method: 'GET',
      url: `/workspaces/${VICTIM_WORKSPACE_ID}`,
      headers: {
        authorization: `Bearer ${FORGED_JWT}`,
      },
    });

    expect(response.statusCode).toBe(404);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/auth/v1/user',
      expect.objectContaining({
        headers: {
          apikey: 'anon-key',
          Authorization: `Bearer ${FORGED_JWT}`,
        },
      }),
    );

    const workspaceLookup = mockDb.query.workspaces.findFirst.mock.calls[0]?.[0] as
      | { where?: unknown }
      | undefined;
    expect(workspaceLookup).toBeDefined();
    expect(predicateContainsEq(workspaceLookup?.where, workspaces.id, VICTIM_WORKSPACE_ID)).toBe(true);
    expect(predicateContainsEq(workspaceLookup?.where, workspaces.userId, ATTACKER_USER_ID)).toBe(true);
    expect(predicateContainsEq(workspaceLookup?.where, workspaces.userId, VICTIM_USER_ID)).toBe(false);

    await app.close();
  });
});

function predicateContainsEq(predicate: unknown, column: unknown, value: unknown): boolean {
  if (!predicate || typeof predicate !== 'object') return false;
  const node = predicate as {
    type?: string;
    column?: unknown;
    value?: unknown;
    conditions?: unknown[];
  };
  if (node.type === 'eq') return node.column === column && node.value === value;
  return node.conditions?.some((child) => predicateContainsEq(child, column, value)) ?? false;
}
