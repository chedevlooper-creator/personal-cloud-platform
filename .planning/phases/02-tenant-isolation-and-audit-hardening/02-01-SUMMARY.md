---
phase: 2
plan: 02-01
subsystem: tenant isolation
tags:
  - security
  - tenant-isolation
  - tests
requires:
  - 01-contracts-config-and-auth-foundation
provides:
  - scoped-db-mutations
  - tenant-isolation-regression-tests
affects:
  - services/workspace/src/datasets/service.ts
  - services/runtime/src/service.ts
  - services/publish/src/service.ts
  - services/agent/src/channels/router.ts
key-files:
  created: []
  modified:
    - services/workspace/src/datasets/service.ts
    - services/workspace/src/datasets/datasets.test.ts
    - services/runtime/src/service.ts
    - services/runtime/src/service.test.ts
    - services/publish/src/service.ts
    - services/publish/src/service.test.ts
    - services/agent/src/channels/router.ts
    - services/agent/src/channels/channels.test.ts
key-decisions:
  - Scope final DB side-effect predicates by user id where tables carry user ownership.
  - Use focused regression tests against Drizzle predicate shape instead of broad repository extraction.
requirements-completed:
  - SEC-02
  - TST-01
duration: 0.4h
completed: 2026-04-29
---

# Phase 2 Plan 02-01: Audit And Enforce DB Resource Scoping Summary

Scoped representative DB side effects so tenant ownership is enforced at the
operation boundary and covered by regression tests.

## What Changed

- Dataset soft delete now includes dataset id, authenticated `userId`, and
  non-deleted predicates.
- Runtime start, stop, and delete lifecycle operations now include `userId` in
  final `runtimes` update/delete predicates.
- Publish service lifecycle status updates now include hosted service id and
  `userId` predicates.
- Agent channel task polling now looks up task completion by task id and the
  linked channel user's `userId`.
- Added regression tests that fail when these representative tenant predicates
  are removed.

## Verification

- `pnpm --filter @pcp/workspace-service test` passed.
- `pnpm --filter @pcp/runtime-service test` passed.
- `pnpm --filter @pcp/publish-service test` passed.
- `pnpm --filter @pcp/agent-service test` passed.
- `pnpm test` passed.
- `pnpm typecheck` passed.
- `pnpm exec prettier --check` passed for touched plan files.

## Deviations from Plan

- A broad commit already existed at HEAD during final verification:
  `2c3f2e0 Harden tenant isolation across runtime and publish flows`. It contains
  the 02-01 code/test changes plus unrelated workspace changes that were outside
  this plan. Those unrelated changes were not reverted.
- Two small test mock follow-ups were needed after that commit so the new tests
  satisfied strict TypeScript interfaces.

**Total deviations:** 1 workflow/state deviation, no code-scope expansion in the
remaining follow-up.
**Impact:** Automated test and typecheck gates are green; unrelated committed
files should be reviewed separately before PR/merge.

## Next

Ready for 02-02: Harden storage paths, runtime labels, and audit coverage.
