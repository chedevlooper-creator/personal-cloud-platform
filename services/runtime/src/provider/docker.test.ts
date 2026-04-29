import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createContainer } = vi.hoisted(() => {
  const mockContainer = { id: 'container-1' };
  return {
    createContainer: vi.fn(async () => mockContainer),
  };
});

vi.mock('dockerode', () => ({
  default: vi.fn(() => ({
    createContainer,
  })),
}));

describe('DockerProvider sandbox options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates runtime containers with non-root, readonly, capability and resource limits', async () => {
    const { DockerProvider } = await import('./docker');
    const provider = new DockerProvider();

    await provider.create('node:20-alpine', {
      workspacePath: '/tmp/workspaces/workspace-1',
      cpu: 99,
      memory: 99_999,
      env: { SAFE_NAME: 'ok', 'BAD=NAME': 'no' },
      labels: {
        'pcp.service': 'runtime',
        'pcp.userId': 'user-1',
        'pcp.workspaceId': 'workspace-1',
        'pcp.runtimeId': 'runtime-1',
      },
    });

    expect(createContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        User: '1000:1000',
        Env: ['SAFE_NAME=ok'],
        Labels: expect.objectContaining({
          'pcp.service': 'runtime',
          'pcp.userId': 'user-1',
          'pcp.workspaceId': 'workspace-1',
          'pcp.runtimeId': 'runtime-1',
        }),
        HostConfig: expect.objectContaining({
          Binds: ['/tmp/workspaces/workspace-1:/workspace'],
          Memory: 4 * 1024 * 1024 * 1024,
          MemorySwap: 4 * 1024 * 1024 * 1024,
          NanoCpus: 4_000_000_000,
          NetworkMode: 'none',
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
});
