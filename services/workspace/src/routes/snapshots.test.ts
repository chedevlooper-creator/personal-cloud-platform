import cookie from '@fastify/cookie';
import { auditLogs } from '@pcp/db/src/schema';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupSnapshotRoutes } from './snapshots';

const SNAPSHOT_ID = '550e8400-e29b-41d4-a716-446655440010';

const { mockDb, auditValues } = vi.hoisted(() => {
  const auditValues: any[] = [];
  const mockDb = {
    insert: vi.fn((table: unknown) => ({
      values: vi.fn(async (value: unknown) => {
        auditValues.push({ table, value });
      }),
    })),
  };
  return { mockDb, auditValues };
});

vi.mock('@pcp/db/src/client', () => ({
  db: mockDb,
}));

describe('snapshot routes audit events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditValues.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits restore audit events with allow-listed snapshot details', async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(cookie);

    await setupSnapshotRoutes(app, {
      validateUserFromCookie: vi.fn(async () => 'user-1'),
      restoreSnapshot: vi.fn(async () => ({ restoredFiles: 2 })),
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: `/snapshots/${SNAPSHOT_ID}/restore`,
      cookies: { sessionId: 'session-1' },
    });

    expect(response.statusCode).toBe(200);
    expect(auditValues).toContainEqual({
      table: auditLogs,
      value: {
        userId: 'user-1',
        action: 'SNAPSHOT_RESTORE',
        details: { snapshotId: SNAPSHOT_ID },
      },
    });

    await app.close();
  });
});
