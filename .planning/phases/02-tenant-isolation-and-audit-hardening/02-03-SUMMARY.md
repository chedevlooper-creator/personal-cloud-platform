---
phase: 2
plan: 02-03
subsystem: tenant isolation
tags:
  - security
  - tests
  - audit
requires:
  - 02-01
  - 02-02
provides:
  - tenant-isolation-regression-suite
  - snapshot-update-scoping
  - workspace-metadata-update-scoping
affects:
  - services/workspace/src/service.ts
  - services/workspace/src/service.test.ts
  - services/workspace/src/routes/snapshots.test.ts
  - services/runtime/src/service.test.ts
  - services/publish/src/service.test.ts
  - services/agent/src/channels/channels.test.ts
key-files:
  created:
    - services/workspace/src/routes/snapshots.test.ts
  modified:
    - services/workspace/src/service.ts
    - services/workspace/src/service.test.ts
    - services/runtime/src/service.test.ts
    - services/publish/src/service.test.ts
    - services/agent/src/channels/channels.test.ts
key-decisions:
  - Assert Drizzle predicate shape for tenant-owned lifecycle mutations.
  - Keep audit route tests focused on allow-listed details instead of broad Fastify route coverage.
  - Treat root web lint failures as pre-existing Phase 5 debt because touched backend service tests and typecheck pass.
requirements-completed:
  - SEC-02
  - SEC-03
  - SEC-04
  - TST-01
duration: 0.4h
completed: 2026-04-29
---

# Phase 2 Plan 02-03: Add Tenant Isolation Regression Tests Summary

Phase 2 tenant isolation contracts now have focused regression coverage across
workspace snapshots, workspace metadata writes, runtime lifecycle, publish
lifecycle, channel task polling, storage paths, container labels, and audit
details.

## What Changed

- Snapshot create/restore/delete status updates now include snapshot id,
  authenticated `userId`, and non-deleted predicates.
- Workspace metadata storage updates now include workspace id and authenticated
  `userId` predicates.
- Workspace service tests now assert traversal paths fail before storage or file
  metadata side effects.
- Runtime tests now cover stop lifecycle scoping and reject command execution
  when a runtime id cannot be resolved for the authenticated tenant.
- Publish tests now cover hosted service delete predicates by service id and
  authenticated `userId`.
- Agent channel tests now prove a poll cannot reply with another tenant's task
  output if the task id collides.
- Snapshot route tests now assert audit details remain allow-listed to
  `{ snapshotId }`.

## Verification

- `pnpm --filter @pcp/workspace-service test` passed.
- `pnpm --filter @pcp/runtime-service test` passed.
- `pnpm --filter @pcp/publish-service test` passed.
- `pnpm --filter @pcp/agent-service test` passed.
- `pnpm test` passed.
- `pnpm typecheck` passed.
- `git diff --check` passed for code changes.

## Deviations from Plan

- `pnpm lint` fails on pre-existing `apps/web` React lint errors in files not
  touched by Phase 2 (`rules/page.tsx`, `create-automation-dialog.tsx`,
  `theme-toggle.tsx`). Backend service tests and typecheck are green.

**Total deviations:** 1 verification-scope deviation.
**Impact:** Phase 2 backend tenant isolation work is verified; root lint remains
blocked by unrelated frontend debt tracked for later delivery/frontend work.

## Next

Ready for Phase 3: Runtime And Publish Sandbox Hardening.
