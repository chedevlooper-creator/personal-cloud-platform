# Phase 6 Context — Runtime Sandbox Regression

**Phase:** 6 — Runtime Sandbox Regression  
**Date:** 2026-05-07  
**Mode:** Infrastructure/security clarification; no user-facing product vision questions required.

## Domain

Phase 6 hardens the command execution boundary for `services/runtime` and `services/publish` and makes the sandbox policy regression-tested before merge.

## Decisions

- Use the existing strict/balanced/permissive terminology from user preferences and runtime README, but make it explicit in code and docs.
- Keep the default execution posture conservative: runtime containers remain network-disabled, read-only rootfs, non-root, capability-dropped, and guarded by no-new-privileges.
- Treat publish as a deployment surface, not an interactive terminal: hosted app start commands may be user-defined but must pass the same deny policy before Docker container creation.
- Prefer shared policy data over duplicated string lists so runtime, publish, and agent tool descriptions cannot drift.
- CI should add a targeted sandbox regression job for PRs that touch runtime, publish, shared policy, Docker policy docs, seccomp, or the workflow itself.
- Do not introduce real Docker integration tests in this phase; keep regression tests deterministic unit tests over policy and Docker host config construction.

## Code Context

- `services/runtime/src/policy.ts` currently owns runtime image allow-listing, command deny checks, and Docker security option validation.
- `services/runtime/src/service.ts` calls `assertRuntimeCommandAllowed` before provider exec and passes `RUNTIME_COMMAND_POLICY.timeoutMs` to Docker.
- `services/runtime/src/provider/docker.ts` applies non-root user, `NetworkMode: 'none'`, read-only rootfs, dropped caps, PID/memory/CPU limits, no-new-privileges, optional seccomp/AppArmor profiles, and tmpfs `/tmp`.
- `services/publish/src/policy.ts` currently owns publish image allow-listing and Docker security option validation.
- `services/publish/src/service.ts` accepts `startCommand`, then launches hosted containers using Docker with read-only workspace bind, resource limits, dropped caps, no-new-privileges, optional seccomp/AppArmor, and the publish Docker network.
- `services/agent/src/tools/run_command.ts` exposes user-facing policy metadata for the `run_command` tool.
- `infra/docker/seccomp-runtime.json` exists and explicitly blocks high-risk syscalls with inline justification.
- `.github/workflows/ci.yml` currently has a single full verification job.

## Canonical Refs

- `.planning/ROADMAP.md` — Phase 6 scope and success criteria.
- `.planning/REQUIREMENTS.md` — SEC-08 requirement.
- `services/runtime/src/policy.ts` — runtime command and Docker profile policy.
- `services/runtime/src/provider/docker.ts` — runtime container sandbox host config.
- `services/publish/src/policy.ts` — publish image and Docker profile policy.
- `services/publish/src/service.ts` — hosted service command/container launch path.
- `services/agent/src/tools/run_command.ts` — agent-facing command policy description.
- `infra/docker/seccomp-runtime.json` — custom seccomp profile and syscall rationale.
- `.github/workflows/ci.yml` — CI enforcement point.

## Deferred Ideas

- Runtime terminal per-user risk scoring is still mostly documented/stubbed and should be handled separately if interactive terminal command interception is required.
- Real Docker/seccomp integration tests can be added later behind an opt-in CI runner with Docker permissions.
