import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440002';
const SERVICE_ID = '550e8400-e29b-41d4-a716-446655440003';

const {
  mockDb,
  createContainer,
  insertedValues,
  updatedValues,
  updateWherePredicates,
  deleteWherePredicates,
} = vi.hoisted(() => {
  const createContainer = vi.fn(async () => ({
    id: 'container-1',
    start: vi.fn(async () => undefined),
  }));
  const insertedValues: Record<string, unknown>[] = [];
  const updatedValues: Record<string, unknown>[] = [];
  const updateWherePredicates: unknown[] = [];
  const deleteWherePredicates: unknown[] = [];

  const mockDb = {
    query: {
      workspaces: { findFirst: vi.fn() },
      hostedServices: { findFirst: vi.fn() },
    },
    insert: vi.fn(() => ({
      values: vi.fn((value: Record<string, unknown>) => ({
        returning: vi.fn(async () => {
          insertedValues.push(value);
          return [hostedService(value)];
        }),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((value: Record<string, unknown>) => ({
        where: vi.fn((predicate: unknown) => {
          updateWherePredicates.push(predicate);
          return {
            returning: vi.fn(async () => {
              updatedValues.push(value);
              return [hostedService(value)];
            }),
          };
        }),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn((predicate: unknown) => {
        deleteWherePredicates.push(predicate);
      }),
    })),
  };

  function hostedService(overrides: Record<string, unknown> = {}) {
    return {
      id: SERVICE_ID,
      userId: USER_ID,
      workspaceId: WORKSPACE_ID,
      name: 'Site',
      slug: 'site',
      kind: 'node',
      rootPath: '/',
      startCommand: 'npm start',
      port: null,
      envVars: { SAFE_NAME: 'ok', 'BAD=NAME': 'no' },
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

  return {
    mockDb,
    createContainer,
    insertedValues,
    updatedValues,
    updateWherePredicates,
    deleteWherePredicates,
  };
});

vi.mock('@pcp/db/src/client', () => ({
  db: mockDb,
}));

vi.mock('drizzle-orm', () => ({
  and: (...conditions: unknown[]) => ({ type: 'and', conditions }),
  eq: (column: unknown, value: unknown) => ({ type: 'eq', column, value }),
  isNull: (column: unknown) => ({ type: 'isNull', column }),
  desc: (column: unknown) => ({ type: 'desc', column }),
}));

vi.mock('dockerode', () => ({
  default: vi.fn(() => ({
    createContainer,
    getContainer: vi.fn(() => ({
      stop: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    })),
  })),
}));

describe('PublishService security boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedValues.length = 0;
    updatedValues.length = 0;
    updateWherePredicates.length = 0;
    deleteWherePredicates.length = 0;
    mockDb.query.workspaces.findFirst.mockResolvedValue({ id: WORKSPACE_ID, userId: USER_ID });
    mockDb.query.hostedServices.findFirst.mockResolvedValue({
      id: SERVICE_ID,
      userId: USER_ID,
      workspaceId: WORKSPACE_ID,
      name: 'Site',
      slug: 'site',
      kind: 'node',
      rootPath: '/',
      startCommand: 'npm start',
      port: null,
      envVars: { SAFE_NAME: 'ok', 'BAD=NAME': 'no' },
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
    });
  });

  it('rejects hosted services for a workspace the user does not own', async () => {
    const { PublishService } = await import('./service');
    mockDb.query.workspaces.findFirst.mockResolvedValueOnce(null);
    const service = new PublishService();

    await expect(
      service.createService({
        userId: USER_ID,
        workspaceId: WORKSPACE_ID,
        name: 'Site',
        slug: 'site',
        kind: 'node',
        rootPath: '/',
      }),
    ).rejects.toThrow('Workspace not found');
  });

  it('encrypts hosted env vars at rest and returns masked env values when creating service', async () => {
    const { PublishService } = await import('./service');
    const service = new PublishService();

    const created = await service.createService({
      userId: USER_ID,
      workspaceId: WORKSPACE_ID,
      name: 'Site',
      slug: 'site',
      kind: 'node',
      rootPath: '/',
      envVars: {
        SECRET_TOKEN: 'super-secret',
        PUBLIC_FLAG: 'enabled',
      },
    });

    const storedEnvVars = capturedEnvVars(insertedValues);
    expect(storedEnvVars.SECRET_TOKEN).toMatch(/^enc:/);
    expect(storedEnvVars.SECRET_TOKEN).not.toContain('super-secret');
    expect(storedEnvVars.PUBLIC_FLAG).toMatch(/^enc:/);
    expect(created.envVars).toEqual({
      SECRET_TOKEN: '***',
      PUBLIC_FLAG: '***',
    });
  });

  it('encrypts hosted env vars at rest and returns masked env values when updating service', async () => {
    const { PublishService } = await import('./service');
    const service = new PublishService();

    const updated = await service.updateService(SERVICE_ID, USER_ID, {
      envVars: {
        SECRET_TOKEN: 'rotated-secret',
      },
    });

    const storedEnvVars = capturedEnvVars(updatedValues);
    expect(storedEnvVars.SECRET_TOKEN).toMatch(/^enc:/);
    expect(storedEnvVars.SECRET_TOKEN).not.toContain('rotated-secret');
    expect(updated.envVars).toEqual({ SECRET_TOKEN: '***' });
  });

  it('starts hosted containers with a restricted host config', async () => {
    const { PublishService } = await import('./service');
    const service = new PublishService();

    await service.startService(SERVICE_ID, USER_ID);

    expect(createContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        User: '1000:1000',
        Env: ['SAFE_NAME=ok'],
        WorkingDir: '/workspace',
        Labels: expect.objectContaining({
          'pcp.service': 'publish',
          'pcp.userId': USER_ID,
          'pcp.workspaceId': WORKSPACE_ID,
          'pcp.hostedServiceId': SERVICE_ID,
        }),
        HostConfig: expect.objectContaining({
          NetworkMode: 'pcp_network',
          Binds: [`/tmp/workspaces/${USER_ID}/${WORKSPACE_ID}:/workspace:ro`],
          Memory: 512 * 1024 * 1024,
          MemorySwap: 512 * 1024 * 1024,
          NanoCpus: 1_000_000_000,
          ReadonlyRootfs: true,
          Privileged: false,
          Init: true,
          OomKillDisable: false,
          CapDrop: ['ALL'],
          PidsLimit: 100,
          SecurityOpt: expect.arrayContaining(['no-new-privileges:true']),
          Tmpfs: expect.objectContaining({ '/tmp': 'rw,noexec,nosuid,size=100m' }),
        }),
      }),
    );
  });

  it('wires configured Docker security profiles into hosted container launches', async () => {
    const originalSeccompProfile = process.env.PUBLISH_SECCOMP_PROFILE;
    const originalAppArmorProfile = process.env.PUBLISH_APPARMOR_PROFILE;
    process.env.PUBLISH_SECCOMP_PROFILE = '/etc/pcp/seccomp-publish.json';
    process.env.PUBLISH_APPARMOR_PROFILE = 'pcp-publish';
    vi.resetModules();

    try {
      const { PublishService } = await import('./service');
      const service = new PublishService();

      await service.startService(SERVICE_ID, USER_ID);

      expect(createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          HostConfig: expect.objectContaining({
            SecurityOpt: expect.arrayContaining([
              'no-new-privileges:true',
              'seccomp=/etc/pcp/seccomp-publish.json',
              'apparmor=pcp-publish',
            ]),
          }),
        }),
      );
    } finally {
      restoreEnvValue('PUBLISH_SECCOMP_PROFILE', originalSeccompProfile);
      restoreEnvValue('PUBLISH_APPARMOR_PROFILE', originalAppArmorProfile);
      vi.resetModules();
    }
  });

  it('scopes hosted service lifecycle status updates by service id and authenticated user', async () => {
    const { PublishService } = await import('./service');
    const { hostedServices } = await import('@pcp/db/src/schema');
    const service = new PublishService();

    await service.startService(SERVICE_ID, USER_ID);

    expect(updateWherePredicates.length).toBeGreaterThan(0);
    expect(
      updateWherePredicates.some((where) =>
        predicateContainsEq(where, hostedServices.id, SERVICE_ID),
      ),
    ).toBe(true);
    expect(
      updateWherePredicates.every((where) =>
        predicateContainsEq(where, hostedServices.userId, USER_ID),
      ),
    ).toBe(true);
  });

  it('scopes hosted service deletes by service id and authenticated user', async () => {
    const { PublishService } = await import('./service');
    const { hostedServices } = await import('@pcp/db/src/schema');
    const service = new PublishService();

    await service.deleteService(SERVICE_ID, USER_ID);

    expect(deleteWherePredicates.length).toBe(1);
    expect(predicateContainsEq(deleteWherePredicates[0], hostedServices.id, SERVICE_ID)).toBe(true);
    expect(predicateContainsEq(deleteWherePredicates[0], hostedServices.userId, USER_ID)).toBe(
      true,
    );
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

function capturedEnvVars(values: Record<string, unknown>[]): Record<string, string> {
  const captured = values.find((value) => 'envVars' in value);
  expect(captured).toBeDefined();
  return (captured as { envVars: Record<string, string> }).envVars;
}

function restoreEnvValue(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
