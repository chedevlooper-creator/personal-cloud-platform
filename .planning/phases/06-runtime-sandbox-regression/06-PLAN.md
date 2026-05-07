# Phase 6 Plan — Runtime Sandbox Regression

**Goal:** Tightened command policy with regressions caught before merge.

## Tasks

1. Add a shared sandbox policy module in `@pcp/shared` for profile names, denied command categories, deny-list evaluation, and command argv validation.
2. Update runtime policy to consume the shared command profile evaluator while preserving existing image allow-listing and Docker security option validation.
3. Update publish policy/service to validate hosted service `startCommand` before Docker container creation and log startup failure instead of launching blocked commands.
4. Update agent `run_command` policy metadata so the tool description reflects the shared deny categories.
5. Document runtime and publish allow/deny behavior in `infra/docker/POLICY.md`, including strict/balanced/permissive profile intent and seccomp notes.
6. Add deterministic regression tests for strict, balanced, and permissive profiles that prove blocked commands stay blocked.
7. Add targeted CI job that runs sandbox regression tests on PRs touching runtime, publish, shared policy, Docker policy docs, seccomp, or CI.
8. Run targeted tests, then root typecheck/lint/test.
9. Update `.planning/STATE.md`, `.planning/PROJECT.md`, and `.planning/REQUIREMENTS.md` for SEC-08 completion.

## Verification

- `pnpm --filter @pcp/shared test src/sandbox-policy.test.ts`
- `pnpm --filter @pcp/runtime-service test src/policy.test.ts`
- `pnpm --filter @pcp/publish-service test src/policy.test.ts src/service.test.ts`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
