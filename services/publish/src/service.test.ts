import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440002';
const SERVICE_ID = '550e8400-e29b-41d4-a716-446655440003';

const {
  mockDb,
  createContainer,
  createdContainer,
  insertedValues,
  insertedValueCalls,
  updatedValues,
  updateWherePredicates,
  deleteWherePredicates,
} = vi.hoisted(() => {
  const createdContainer = {
    id: 'container-1',
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  };
  const createContainer = vi.fn(async () => createdContainer);
  const insertedValues: Record<string, unknown>[] = [];
  const updatedValues: Record<string, unknown>[] = [];
  const insertedValueCalls: Record<string, unknown>[] = [];
  const updateWherePredicates: unknown[] = [];
  const deleteWherePredicates: unknown[] = [];

  const mockDb = {
    query: {
      workspaces: { findFirst: vi.fn() },
      hostedServices: { findFirst: vi.fn() },
    },
    insert: vi.fn(() => ({
      values: vi.fn((value: Record<string, unknown>) => {
        insertedValueCalls.push(value);
        return {
          returning: vi.fn(async () => {
            insertedValues.push(value);
            return [hostedService(value)];
          }),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((value: Record<string, unknown>) => ({
        where: vi.fn((predicate: unknown) => {
          updatedValues.push(value);
          updateWherePredicates.push(predicate);
          return {
            returning: vi.fn(async () => {
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
    createdContainer,
    insertedValues,
    insertedValueCalls,
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
    insertedValueCalls.length = 0;
    updatedValues.length = 0;
    updateWherePredicates.length = 0;
    deleteWherePredicates.length = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ files: [] }),
      })),
    );
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

    await waitForExpectation(() => expect(createContainer).toHaveBeenCalled());
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
          NetworkMode: 'pcp-publish',
          Binds: [`${resolve('/tmp/workspaces', USER_ID, WORKSPACE_ID)}:/workspace:ro`],
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

  it('removes a created hosted container when startup fails after Docker creation', async () => {
    const { PublishService } = await import('./service');
    createdContainer.start.mockRejectedValueOnce(new Error('start failed'));
    const service = new PublishService();

    await service.startService(SERVICE_ID, USER_ID);

    await waitForExpectation(() =>
      expect(updatedValues).toContainEqual(expect.objectContaining({ status: 'crashed' })),
    );
    expect(createdContainer.stop).toHaveBeenCalled();
    expect(createdContainer.remove).toHaveBeenCalled();
    expect(insertedValueCalls).toContainEqual(
      expect.objectContaining({
        serviceId: SERVICE_ID,
        stream: 'stderr',
        line: 'start failed',
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

      await waitForExpectation(() => expect(createContainer).toHaveBeenCalled());
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

  it('fetches and materializes workspace source before hosted container launch', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'pcp-publish-'));
    const originalRoot = process.env.PUBLISH_WORKSPACE_HOST_ROOT;
    const originalWorkspaceUrl = process.env.WORKSPACE_SERVICE_URL;
    const originalToken = process.env.INTERNAL_SERVICE_TOKEN;
    process.env.PUBLISH_WORKSPACE_HOST_ROOT = workspaceRoot;
    process.env.WORKSPACE_SERVICE_URL = 'http://workspace.test/api';
    process.env.INTERNAL_SERVICE_TOKEN = 'internal-token'.repeat(3);
    vi.resetModules();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        files: [
          {
            path: '/src',
            isDirectory: true,
            size: 0,
            mimeType: null,
            contentBase64: null,
          },
          {
            path: '/src/app.js',
            isDirectory: false,
            size: 21,
            mimeType: 'text/javascript',
            contentBase64: Buffer.from('console.log("ready");').toString('base64'),
          },
          {
            path: '/empty.txt',
            isDirectory: false,
            size: 0,
            mimeType: 'text/plain',
            contentBase64: '',
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      const { PublishService } = await import('./service');
      const service = new PublishService();

      await service.startService(SERVICE_ID, USER_ID);

      await waitForExpectation(() => expect(createContainer).toHaveBeenCalled());
      expect(fetchMock).toHaveBeenCalledWith(
        'http://workspace.test/api/workspaces/550e8400-e29b-41d4-a716-446655440002/sync/manifest',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}`,
            'X-User-Id': USER_ID,
          }),
        }),
      );
      await expect(
        readFile(join(workspaceRoot, USER_ID, WORKSPACE_ID, 'src', 'app.js'), 'utf8'),
      ).resolves.toBe('console.log("ready");');
      await expect(
        readFile(join(workspaceRoot, USER_ID, WORKSPACE_ID, 'empty.txt')),
      ).resolves.toEqual(Buffer.alloc(0));
      expect(createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          HostConfig: expect.objectContaining({
            Binds: [`${join(workspaceRoot, USER_ID, WORKSPACE_ID)}:/workspace:ro`],
          }),
        }),
      );
    } finally {
      vi.unstubAllGlobals();
      restoreEnvValue('PUBLISH_WORKSPACE_HOST_ROOT', originalRoot);
      restoreEnvValue('WORKSPACE_SERVICE_URL', originalWorkspaceUrl);
      restoreEnvValue('INTERNAL_SERVICE_TOKEN', originalToken);
      vi.resetModules();
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('removes stale workspace files before materializing published source', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'pcp-publish-'));
    const originalRoot = process.env.PUBLISH_WORKSPACE_HOST_ROOT;
    const originalToken = process.env.INTERNAL_SERVICE_TOKEN;
    process.env.PUBLISH_WORKSPACE_HOST_ROOT = workspaceRoot;
    process.env.INTERNAL_SERVICE_TOKEN = 'internal-token'.repeat(3);
    vi.resetModules();
    await mkdir(join(workspaceRoot, USER_ID, WORKSPACE_ID), { recursive: true });
    await writeFile(join(workspaceRoot, USER_ID, WORKSPACE_ID, 'old.txt'), 'stale');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          files: [
            {
              path: '/new.txt',
              isDirectory: false,
              size: 5,
              mimeType: 'text/plain',
              contentBase64: Buffer.from('fresh').toString('base64'),
            },
          ],
        }),
      })),
    );

    try {
      const { PublishService } = await import('./service');
      const service = new PublishService();

      await service.startService(SERVICE_ID, USER_ID);

      await waitForExpectation(() => expect(createContainer).toHaveBeenCalled());
      await expect(
        readFile(join(workspaceRoot, USER_ID, WORKSPACE_ID, 'new.txt'), 'utf8'),
      ).resolves.toBe('fresh');
      await expect(pathExists(join(workspaceRoot, USER_ID, WORKSPACE_ID, 'old.txt'))).resolves.toBe(
        false,
      );
    } finally {
      vi.unstubAllGlobals();
      restoreEnvValue('PUBLISH_WORKSPACE_HOST_ROOT', originalRoot);
      restoreEnvValue('INTERNAL_SERVICE_TOKEN', originalToken);
      vi.resetModules();
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('fails closed and skips container creation when materialization rejects manifest content', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'pcp-publish-'));
    const originalRoot = process.env.PUBLISH_WORKSPACE_HOST_ROOT;
    const originalToken = process.env.INTERNAL_SERVICE_TOKEN;
    process.env.PUBLISH_WORKSPACE_HOST_ROOT = workspaceRoot;
    process.env.INTERNAL_SERVICE_TOKEN = 'internal-token'.repeat(3);
    vi.resetModules();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          files: [
            {
              path: '/../escape.txt',
              isDirectory: false,
              size: 4,
              mimeType: 'text/plain',
              contentBase64: Buffer.from('nope').toString('base64'),
            },
          ],
        }),
      })),
    );

    try {
      const { PublishService } = await import('./service');
      const service = new PublishService();

      await service.startService(SERVICE_ID, USER_ID);

      await waitForExpectation(() =>
        expect(updatedValues).toContainEqual(expect.objectContaining({ status: 'crashed' })),
      );
      expect(createContainer).not.toHaveBeenCalled();
      expect(insertedValueCalls).toContainEqual(
        expect.objectContaining({
          serviceId: SERVICE_ID,
          stream: 'stderr',
          line: expect.stringContaining('materialization'),
        }),
      );
    } finally {
      vi.unstubAllGlobals();
      restoreEnvValue('PUBLISH_WORKSPACE_HOST_ROOT', originalRoot);
      restoreEnvValue('INTERNAL_SERVICE_TOKEN', originalToken);
      vi.resetModules();
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('fails closed and records workspace service failures before Docker creation', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'pcp-publish-'));
    const originalRoot = process.env.PUBLISH_WORKSPACE_HOST_ROOT;
    const originalWorkspaceUrl = process.env.WORKSPACE_SERVICE_URL;
    const originalToken = process.env.INTERNAL_SERVICE_TOKEN;
    process.env.PUBLISH_WORKSPACE_HOST_ROOT = workspaceRoot;
    process.env.WORKSPACE_SERVICE_URL = 'http://workspace.test/api';
    process.env.INTERNAL_SERVICE_TOKEN = 'internal-token'.repeat(3);
    vi.resetModules();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
        statusText: 'Unavailable',
        text: async () => 'down',
      })),
    );

    try {
      const { PublishService } = await import('./service');
      const service = new PublishService();

      await service.startService(SERVICE_ID, USER_ID);

      await waitForExpectation(() =>
        expect(updatedValues).toContainEqual(expect.objectContaining({ status: 'crashed' })),
      );
      expect(createContainer).not.toHaveBeenCalled();
      expect(insertedValueCalls).toContainEqual(
        expect.objectContaining({
          serviceId: SERVICE_ID,
          stream: 'stderr',
          line: expect.stringContaining('workspace service 503: down'),
        }),
      );
    } finally {
      vi.unstubAllGlobals();
      restoreEnvValue('PUBLISH_WORKSPACE_HOST_ROOT', originalRoot);
      restoreEnvValue('WORKSPACE_SERVICE_URL', originalWorkspaceUrl);
      restoreEnvValue('INTERNAL_SERVICE_TOKEN', originalToken);
      vi.resetModules();
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('fails closed when a manifest file is missing inline content', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'pcp-publish-'));
    const originalRoot = process.env.PUBLISH_WORKSPACE_HOST_ROOT;
    const originalToken = process.env.INTERNAL_SERVICE_TOKEN;
    process.env.PUBLISH_WORKSPACE_HOST_ROOT = workspaceRoot;
    process.env.INTERNAL_SERVICE_TOKEN = 'internal-token'.repeat(3);
    vi.resetModules();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          files: [
            {
              path: '/missing.txt',
              isDirectory: false,
              size: 5,
              mimeType: 'text/plain',
              contentBase64: null,
            },
          ],
        }),
      })),
    );

    try {
      const { PublishService } = await import('./service');
      const service = new PublishService();

      await service.startService(SERVICE_ID, USER_ID);

      await waitForExpectation(() =>
        expect(updatedValues).toContainEqual(expect.objectContaining({ status: 'crashed' })),
      );
      expect(createContainer).not.toHaveBeenCalled();
      expect(insertedValueCalls).toContainEqual(
        expect.objectContaining({
          serviceId: SERVICE_ID,
          stream: 'stderr',
          line: expect.stringContaining('missing content for /missing.txt'),
        }),
      );
    } finally {
      vi.unstubAllGlobals();
      restoreEnvValue('PUBLISH_WORKSPACE_HOST_ROOT', originalRoot);
      restoreEnvValue('INTERNAL_SERVICE_TOKEN', originalToken);
      vi.resetModules();
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('uses the configured publish-only Docker network for hosted containers', async () => {
    const originalNetwork = process.env.PUBLISH_DOCKER_NETWORK;
    process.env.PUBLISH_DOCKER_NETWORK = 'custom-publish-network';
    vi.resetModules();

    try {
      const { PublishService } = await import('./service');
      const service = new PublishService();

      await service.startService(SERVICE_ID, USER_ID);

      await waitForExpectation(() => expect(createContainer).toHaveBeenCalled());
      expect(createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          HostConfig: expect.objectContaining({
            NetworkMode: 'custom-publish-network',
          }),
        }),
      );
    } finally {
      restoreEnvValue('PUBLISH_DOCKER_NETWORK', originalNetwork);
      vi.resetModules();
    }
  });

  it('scopes hosted service lifecycle status updates by service id and authenticated user', async () => {
    const { PublishService } = await import('./service');
    const { hostedServices } = await import('@pcp/db/src/schema');
    const service = new PublishService();

    await service.startService(SERVICE_ID, USER_ID);

    await waitForExpectation(() => expect(updateWherePredicates.length).toBeGreaterThan(0));
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

async function waitForExpectation(assertion: () => void): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  throw lastError;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
