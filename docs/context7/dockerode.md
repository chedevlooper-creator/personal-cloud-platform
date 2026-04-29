# Dockerode — services/runtime, services/publish

## Create + start container (sandbox baseline)

```ts
import Docker from 'dockerode';
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const container = await docker.createContainer({
  Image: 'node:20-alpine',
  name: `pcp-runtime-${runtimeId}`,
  Cmd: ['/bin/sh', '-c', userCmd],
  Tty: false,
  AttachStdin: false,
  AttachStdout: true,
  AttachStderr: true,
  Labels: {
    'pcp.tenant.userId': String(userId),
    'pcp.tenant.workspaceId': String(workspaceId),
  },
  HostConfig: {
    AutoRemove: true,
    NetworkMode: 'pcp_runtime',
    Memory: 512 * 1024 * 1024,
    NanoCpus: 1_000_000_000, // 1 vCPU
    PidsLimit: 256,
    ReadonlyRootfs: true,
    Tmpfs: { '/tmp': 'rw,noexec,nosuid,size=64m' },
    SecurityOpt: ['no-new-privileges:true'],
    CapDrop: ['ALL'],
    RestartPolicy: { Name: 'no' },
  },
});
await container.start();
```

## Attach (multiplexed stdout/stderr)

```ts
const stream = await container.attach({ stream: true, stdout: true, stderr: true, stdin: false });
container.modem.demuxStream(stream, process.stdout, process.stderr);
```

## TTY attach (terminal/xterm)

```ts
const c = await docker.createContainer({
  Image: 'ubuntu',
  Tty: true, OpenStdin: true,
  AttachStdin: true, AttachStdout: true, AttachStderr: true,
  Cmd: ['/bin/bash'],
});
const s = await c.attach({ stream: true, stdout: true, stderr: true, stdin: true });
s.pipe(process.stdout);
await c.start();
await c.resize({ h: rows, w: cols });
```

## Stats (live)

```ts
container.stats({ stream: true }, (err, stream) => {
  stream!.on('data', (chunk) => {
    const s = JSON.parse(chunk.toString());
    const cpuPct = ((s.cpu_stats.cpu_usage.total_usage - s.precpu_stats.cpu_usage.total_usage)
                  / (s.cpu_stats.system_cpu_usage - s.precpu_stats.system_cpu_usage))
                  * s.cpu_stats.online_cpus * 100;
    metrics.gauge('runtime.cpu_pct', cpuPct, { runtimeId });
  });
});
```

## Network izolasyonu

```ts
await docker.createNetwork({
  Name: 'pcp_runtime',
  Driver: 'bridge',
  Internal: true, // dış internet erişimi yok
  Labels: { 'pcp.purpose': 'runtime' },
});
```

## Prune

```ts
await docker.pruneContainers();
await docker.pruneVolumes();
await docker.pruneBuilder();
```

## Proje notları (security)
- `ReadonlyRootfs: true`, `CapDrop: ['ALL']`, `no-new-privileges`, `PidsLimit`, `Memory`, `NanoCpus` ZORUNLU.
- Hiçbir tenant container Docker socket'i mount etmemeli.
- Container'a tenant label ekleyip cleanup/scan'i label ile yap.
- `Internal: true` network ile egress'i Traefik/proxy üzerinden yönlendir.
- Production'da gVisor (`runsc`) veya kata-runtime'a geçiş düşünülmeli.
