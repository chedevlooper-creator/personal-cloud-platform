# Runtime And Publish Sandbox Policy

This document is the canonical allow/deny policy for user-controlled command execution in the runtime and publish services.

## Runtime Surface

Runtime commands enter through `services/runtime/src/service.ts` via `/runtimes/:id/exec`. The agent `run_command` tool sends commands as `['/bin/sh', '-c', input]` after explicit tool approval.

Runtime containers are created by `services/runtime/src/provider/docker.ts` with:

- `User: '1000:1000'`
- `NetworkMode: 'none'`
- `ReadonlyRootfs: true`
- `Privileged: false`
- `CapDrop: ['ALL']`
- `PidsLimit: 100`
- `SecurityOpt: ['no-new-privileges:true', ...optional seccomp/AppArmor]`
- `/tmp` mounted as `rw,noexec,nosuid,size=100m`
- CPU and memory clamped by service code

Allowed runtime images come from `RUNTIME_IMAGE_ALLOWLIST`; the development default is `node:20-alpine`.

## Publish Surface

Publish commands enter through hosted service `startCommand` or built-in kind defaults in `services/publish/src/service.ts`. Before Docker container creation, the resolved command argv is checked against the same shared deny policy as runtime.

Publish containers are created with:

- `User: '1000:1000'`
- `NetworkMode: PUBLISH_DOCKER_NETWORK` for Traefik reachability
- workspace bind mounted read-only as `/workspace:ro`
- `ReadonlyRootfs: true`
- `Privileged: false`
- `CapDrop: ['ALL']`
- `PidsLimit: 100`
- `SecurityOpt: ['no-new-privileges:true', ...optional seccomp/AppArmor]`
- `/tmp` mounted as `rw,noexec,nosuid,size=100m`
- fixed CPU and memory caps

Allowed publish images are `node:20-alpine` for Node/Vite and `nginxinc/nginx-unprivileged:alpine` for static sites.

## Command Profiles

The shared implementation lives in `packages/shared/src/sandbox-policy.ts`. Unknown or legacy profile values normalize to `balanced`.

| Profile | Denied Categories | Intended Use |
| --- | --- | --- |
| `strict` | destructive root deletion, privilege escalation, fork bomb, network fetcher, package install | Maximum lockdown for untrusted commands or sensitive workspaces. |
| `balanced` | destructive root deletion, privilege escalation, fork bomb, network fetcher | Default posture. Allows local build/install workflows while preserving network-disabled runtime behavior. |
| `permissive` | destructive root deletion, privilege escalation, fork bomb | Development escape hatch for trusted users; still blocks critical host/container abuse patterns. |

All profiles also reject malformed argv: empty command arrays, empty arguments, NUL bytes, more than 64 args, or any single arg over 4096 bytes.

## Seccomp Review

`infra/docker/seccomp-runtime.json` is deny-by-default with an explicit allow set. It also carries a second explicit deny block for high-risk syscalls (`mount`, `ptrace`, kernel module operations, `bpf`, keyring operations, and related host-control calls) with the inline comment:

`Explicitly block high-risk syscalls even if defaultAction changes`

Phase 6 does not add new syscalls. Any future syscall addition must include an inline justification in the JSON object that introduces it and a regression test or review note proving why the runtime/publish workload requires it.

## Regression Commands

CI runs the sandbox regression suite when PRs touch runtime, publish, shared sandbox policy, Docker policy docs, seccomp, or the CI workflow.

Current required checks:

- `pnpm --filter @pcp/shared exec vitest run src/sandbox-policy.test.ts`
- `pnpm --filter @pcp/runtime-service exec vitest run src/policy.test.ts`
- `pnpm --filter @pcp/publish-service exec vitest run src/policy.test.ts src/service.test.ts`
