# @pcp/runtime-service

Fastify v4 service that controls per-workspace Docker containers and exposes
PTY terminals over WebSocket. Port **3003**, routes under `/api`.

## Routes

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/runtimes` | Create a runtime for a workspace. |
| `POST` | `/api/runtimes/ensure` | Idempotent: return the workspace's runtime, creating one if needed. |
| `POST` | `/api/runtimes/:id/start` | Start container. |
| `POST` | `/api/runtimes/:id/stop` | Stop container. |
| `POST` | `/api/runtimes/:id/exec` | Run an argv array (`/bin/sh -c …` style). Used by the `run_command` agent tool. |
| `DELETE` | `/api/runtimes/:id` | Remove container + row. |
| `WS` | `/api/runtimes/:id/terminal` | xterm.js PTY stream. |

## Sandbox defaults

Configured in `src/provider/docker.ts` for every container:

- `NetworkMode: 'none'` — no outbound network by default.
- `ReadonlyRootfs: true`.
- `CapDrop: ['ALL']`, `SecurityOpt: ['no-new-privileges:true']`.
- Memory clamped to **512 MB** default, **4096 MB** max.
- CPU quota expressed as `NanoCpus`.
- `/tmp` mounted as `tmpfs` (`rw,noexec,nosuid,size=100m`).

Tighter hardening (seccomp / AppArmor profiles, image allow-list,
per-tenant network isolation) is tracked in
[docs/PRODUCTION.md](../../docs/PRODUCTION.md) under sandbox readiness.

## Terminal policy

Terminal commands are persisted to `terminal_commands` with a `policy`
field of `safe`, `needs_approval`, or `blocked`. The user's
`user_preferences.terminalRiskLevel` (`strict`/`normal`/`permissive`)
selects which patterns enter `needs_approval` versus `safe`. Blocked
commands are refused server-side.

## Environment

| Variable | Purpose |
| --- | --- |
| `DOCKER_HOST` | Optional override for the Docker socket. |
| `RUNTIME_DEFAULT_IMAGE` | Image used when a workspace doesn't pin one. |
| `INTERNAL_SERVICE_TOKEN` | Required for tool-driven `/exec` calls from the agent service. |
| `AUTH_SERVICE_URL` | Cookie session validation. |
| `DATABASE_URL` | Drizzle connection. |

## Scripts

```bash
pnpm --filter @pcp/runtime-service dev
pnpm --filter @pcp/runtime-service build
pnpm --filter @pcp/runtime-service test
pnpm --filter @pcp/runtime-service typecheck
```

## Provider abstraction

`src/provider/types.ts` defines the runtime interface so Docker can be
replaced (e.g. Firecracker, gVisor) without touching routes or service
logic. The default `DockerProvider` uses `dockerode`.
