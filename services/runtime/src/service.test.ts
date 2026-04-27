import { beforeEach, describe, expect, it, vi } from 'vitest';
import pino from 'pino';

const USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440002';

const { mockDb, providerCreate } = vi.hoisted(() => {
  const providerCreate = vi.fn(async () => 'container-1');
  const insertReturning = vi.fn(async () => [
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      userId: USER_ID,
      workspaceId: WORKSPACE_ID,
      image: 'node:20-alpine',
      containerId: 'container-1',
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
      runtimes: { findFirst: vi.fn() },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: insertReturning,
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(),
    })),
  };

  return { mockDb, providerCreate };
});

vi.mock('@pcp/db/src/client', () => ({
  db: mockDb,
}));

vi.mock('./provider/docker', () => ({
  DockerProvider: vi.fn(() => ({
    create: providerCreate,
    start: vi.fn(),
    stop: vi.fn(),
    destroy: vi.fn(),
    exec: vi.fn(),
    attach: vi.fn(),
    getStatus: vi.fn(),
  })),
}));

describe('RuntimeService workspace ownership', () => {
  const logger = pino({ level: 'silent' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects runtime creation for a workspace the user does not own', async () => {
    const { RuntimeService } = await import('./service');
    mockDb.query.workspaces.findFirst.mockResolvedValue(null);
    const service = new RuntimeService(logger);

    await expect(
      service.createRuntime(USER_ID, WORKSPACE_ID, 'node:20-alpine', {}),
    ).rejects.toThrow('Workspace not found');

    expect(providerCreate).not.toHaveBeenCalled();
  });
});
