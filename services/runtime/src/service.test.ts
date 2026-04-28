import { beforeEach, describe, expect, it, vi } from 'vitest';
import pino from 'pino';

const USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440002';

const { mockDb, providerCreate, providerStart, providerDestroy } = vi.hoisted(() => {
  const providerCreate = vi.fn(async () => 'container-1');
  const providerStart = vi.fn();
  const providerDestroy = vi.fn();
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

  return { mockDb, providerCreate, providerStart, providerDestroy };
});

vi.mock('@pcp/db/src/client', () => ({
  db: mockDb,
}));

vi.mock('drizzle-orm', () => ({
  and: (...conditions: unknown[]) => ({ type: 'and', conditions }),
  eq: (column: unknown, value: unknown) => ({ type: 'eq', column, value }),
  isNull: (column: unknown) => ({ type: 'isNull', column }),
  desc: (column: unknown) => ({ type: 'desc', column }),
  ne: (column: unknown, value: unknown) => ({ type: 'ne', column, value }),
}));

vi.mock('./provider/docker', () => ({
  DockerProvider: vi.fn(() => ({
    create: providerCreate,
    start: providerStart,
    stop: vi.fn(),
    destroy: providerDestroy,
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

  it('scopes runtime status updates by runtime id and authenticated user', async () => {
    const { RuntimeService } = await import('./service');
    const { runtimes } = await import('@pcp/db/src/schema');
    let updateWhere: unknown;
    mockDb.query.runtimes.findFirst.mockResolvedValue({
      id: 'runtime-1',
      userId: USER_ID,
      workspaceId: WORKSPACE_ID,
      containerId: 'container-1',
      status: 'stopped',
    });
    mockDb.update.mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn((predicate: unknown) => {
          updateWhere = predicate;
        }),
      })),
    });
    const service = new RuntimeService(logger);

    await service.startRuntime('runtime-1', USER_ID);

    expect(providerStart).toHaveBeenCalledWith('container-1');
    expect(predicateContainsEq(updateWhere, runtimes.id, 'runtime-1')).toBe(true);
    expect(predicateContainsEq(updateWhere, runtimes.userId, USER_ID)).toBe(true);
  });

  it('scopes runtime deletes by runtime id and authenticated user', async () => {
    const { RuntimeService } = await import('./service');
    const { runtimes } = await import('@pcp/db/src/schema');
    let deleteWhere: unknown;
    mockDb.query.runtimes.findFirst.mockResolvedValue({
      id: 'runtime-1',
      userId: USER_ID,
      workspaceId: WORKSPACE_ID,
      containerId: 'container-1',
      status: 'stopped',
    });
    mockDb.delete.mockReturnValue({
      where: vi.fn((predicate: unknown) => {
        deleteWhere = predicate;
      }),
    });
    const service = new RuntimeService(logger);

    await service.deleteRuntime('runtime-1', USER_ID);

    expect(providerDestroy).toHaveBeenCalledWith('container-1');
    expect(predicateContainsEq(deleteWhere, runtimes.id, 'runtime-1')).toBe(true);
    expect(predicateContainsEq(deleteWhere, runtimes.userId, USER_ID)).toBe(true);
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
