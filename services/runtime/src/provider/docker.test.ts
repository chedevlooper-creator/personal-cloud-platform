import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createContainer, containerExec } = vi.hoisted(() => {
  const mockContainer = { id: 'container-1' };
  const containerExec = vi.fn(async () => ({
    start: vi.fn(async () => ({
      on: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    })),
  }));
  return {
    createContainer: vi.fn(async () => mockContainer),
    containerExec,
  };
});

vi.mock('dockerode', () => ({
  default: vi.fn(() => ({
    createContainer,
    getContainer: vi.fn(() => ({
      exec: containerExec,
      modem: { demuxStream: vi.fn() },
    })),
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

  it('wires configured Docker security profiles into runtime container launches', async () => {
    const originalSeccompProfile = process.env.RUNTIME_SECCOMP_PROFILE;
    const originalAppArmorProfile = process.env.RUNTIME_APPARMOR_PROFILE;
    process.env.RUNTIME_SECCOMP_PROFILE = '/etc/pcp/seccomp-runtime.json';
    process.env.RUNTIME_APPARMOR_PROFILE = 'pcp-runtime';
    vi.resetModules();

    try {
      const { DockerProvider } = await import('./docker');
      const provider = new DockerProvider();

      await provider.create('node:20-alpine', {
        workspacePath: '/tmp/workspaces/workspace-1',
      });

      expect(createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          HostConfig: expect.objectContaining({
            SecurityOpt: expect.arrayContaining([
              'no-new-privileges:true',
              'seccomp=/etc/pcp/seccomp-runtime.json',
              'apparmor=pcp-runtime',
            ]),
          }),
        }),
      );
    } finally {
      restoreEnvValue('RUNTIME_SECCOMP_PROFILE', originalSeccompProfile);
      restoreEnvValue('RUNTIME_APPARMOR_PROFILE', originalAppArmorProfile);
      vi.resetModules();
    }
  });

  it('creates exec sessions as the sandbox user in the workspace', async () => {
    const { DockerProvider } = await import('./docker');
    const provider = new DockerProvider();

    await provider.attach('container-1');

    expect(containerExec).toHaveBeenCalledWith(
      expect.objectContaining({
        Cmd: ['/bin/sh'],
        User: '1000:1000',
        WorkingDir: '/workspace',
        Tty: true,
      }),
    );
  });
});

function restoreEnvValue(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
