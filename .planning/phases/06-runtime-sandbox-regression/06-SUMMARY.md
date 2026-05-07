# Phase 6 Summary — Runtime Sandbox Regression

**Status:** Completed  
**Date:** 2026-05-07

## Completed

- Added shared sandbox command profiles in `packages/shared/src/sandbox-policy.ts`.
- Added strict, balanced, and permissive regression tests in `packages/shared/src/sandbox-policy.test.ts`.
- Updated runtime command policy to consume the shared deny-list/profile evaluator.
- Updated publish command policy and blocked unsafe hosted `startCommand` values before Docker container creation.
- Updated agent `run_command` metadata to read policy values from shared policy data.
- Added `infra/docker/POLICY.md` documenting runtime/publish command policy, Docker hardening, profile intent, and seccomp review requirements.
- Added a PR-only sandbox regression CI job path-filtered to runtime, publish, shared sandbox policy, Docker policy/seccomp, and CI changes.

## Verification

- `pnpm --filter @pcp/shared exec vitest run src/sandbox-policy.test.ts` — passed.
- `pnpm --filter @pcp/runtime-service exec vitest run src/policy.test.ts` — passed.
- `pnpm --filter @pcp/publish-service exec vitest run src/policy.test.ts src/service.test.ts` — passed.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm test` — passed.

## Notes

- No new seccomp syscalls were added in this phase.
- Interactive terminal command interception remains a separate future concern; this phase covers runtime exec and publish startup command policy.
