---
phase: 6
plan: 01
name: runtime-hardening
objective: Harden runtime containers with seccomp profiles, audit logging, and configurable image policies
gap_closure: true
autonomous: true
wave: 1
cross_ai: false
files_modified:
  - services/runtime/src/policy.ts
  - services/runtime/src/provider/docker.ts
  - services/runtime/src/service.ts
  - services/runtime/src/routes.ts
  - infra/docker/seccomp-runtime.json
---

# Plan 06-01: Runtime Hardening

## Objective

Production-ready runtime sandbox security. The runtime service already has strong defaults (network none, readonly rootfs, non-root user, capdrop ALL). This plan adds missing pieces: a default seccomp profile, security audit logging, and configurable image policies.

## Background

From `AGENTS.md`:
> Docker is the MVP runtime boundary; production-readiness work must reduce host escape and resource exhaustion risk before enabling untrusted execution broadly.

Current state (already implemented):
- NetworkMode: 'none'
- ReadonlyRootfs: true
- Privileged: false
- User: '1000:1000'
- CapDrop: ['ALL']
- PidsLimit: 100
- Memory/CPU limits with clamping
- Tmpfs with noexec,nosuid
- Image whitelist: ['node:20-alpine']
- Command blocking (rm -rf /, sudo, fork bomb)
- SecurityOpt with seccomp/apparmor profile support
- Tests: 19/19 passing

## Tasks

### Task 1: Add default seccomp profile (0.5h)

Create `infra/docker/seccomp-runtime.json` — a restrictive seccomp profile that allows common syscalls for Node.js/alpine but blocks dangerous ones (mount, pivot_root, ptrace, etc.).

### Task 2: Make image whitelist configurable (0.5h)

Move `RUNTIME_IMAGE_ALLOWLIST` from hardcoded array to env-based configuration with safe defaults.

### Task 3: Add runtime security audit logging (1h)

Log security-relevant events to audit_logs table:
- Container creation (image, user, resource limits)
- Blocked commands
- Policy violations
- Container escapes / OOM kills

### Task 4: Add runtime health checks (0.5h)

Periodically verify running containers haven't been tampered with (check Pid count, network mode, readonly status).

### Task 5: Tests (0.5h)

- Seccomp profile validation
- Configurable image whitelist
- Audit log insertion

## Success Criteria

- [ ] Default seccomp profile exists and is referenced in docker compose
- [ ] Image whitelist is configurable via env
- [ ] Security events are logged to audit_logs
- [ ] Runtime tests still pass
- [ ] `pnpm typecheck` passes

## Deviations

If seccomp profile is too restrictive for some workloads, document the minimum required syscalls and provide a relaxed profile option.
