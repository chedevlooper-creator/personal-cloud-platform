---
phase: 3
plan: 03-02
subsystem: runtime sandbox
tags:
  - image-policy
  - command-policy
  - tests
requires:
  - 03-01
provides:
  - runtime-image-allow-list
  - publish-image-policy
  - run-command-policy-metadata
affects:
  - services/runtime/src/policy.ts
  - services/runtime/src/service.ts
  - services/runtime/src/service.test.ts
  - services/publish/src/policy.ts
  - services/publish/src/policy.test.ts
  - services/publish/src/service.ts
  - services/agent/src/tools/run_command.ts
  - services/agent/src/tools/run_command.test.ts
key-files:
  created:
    - services/runtime/src/policy.ts
    - services/publish/src/policy.ts
    - services/publish/src/policy.test.ts
    - services/agent/src/tools/run_command.test.ts
  modified:
    - services/runtime/src/service.ts
    - services/runtime/src/service.test.ts
    - services/publish/src/service.ts
    - services/agent/src/tools/run_command.ts
key-decisions:
  - Reject runtime images before DB insert or Docker container creation.
  - Keep publish images internally resolved and allow-listed by hosted service kind.
  - Surface run_command policy from a structured constant used by the tool description.
requirements-completed:
  - SBOX-02
  - SBOX-03
  - TST-01
duration: 0.3h
completed: 2026-04-29
---

# Phase 3 Plan 03-02: Add Image And Execution Policy Visibility Summary

Runtime image selection, publish image selection, and agent command policy are
now explicit and test-covered.

## What Changed

- Added runtime policy module with:
  - runtime image allow-list
  - command timeout/network metadata
  - blocked command categories
  - command/image assertion helpers
- Runtime creation now rejects unapproved images before inserting a runtime row
  or calling Docker.
- Runtime command execution now uses the shared command policy timeout and
  blocked-command helper.
- Added publish policy module that resolves hosted service kinds to allow-listed
  images.
- Publish container launch now resolves images through the publish image policy
  before Docker container creation.
- Agent `run_command` now exposes approval, timeout, network, output limit, and
  blocked-command policy from structured metadata instead of free-text-only
  duplication.

## Verification

- RED confirmed:
  - Runtime accepted `busybox:latest` before policy enforcement.
  - Publish policy module was missing before implementation.
  - `RUN_COMMAND_POLICY` was missing from the agent tool.
- GREEN confirmed:
  - `pnpm --filter @pcp/runtime-service test` passed.
  - `pnpm --filter @pcp/publish-service test` passed.
  - `pnpm --filter @pcp/agent-service test` passed.
  - `pnpm test` passed.
  - `pnpm typecheck` passed.
  - `pnpm exec prettier --check` passed for touched code/test files.
  - `git diff --check` passed.

## Deviations from Plan

- `pnpm lint` still fails on pre-existing `apps/web` React lint errors outside
  this sandbox plan.
- Existing dirty memory migration/service files were present during execution
  and were not staged or modified by this plan.

**Total deviations:** 2 known scope/verification deviations.
**Impact:** Runtime/publish/agent policy work is verified; unrelated frontend
lint and memory changes remain separate.

## Next

Ready for 03-03: Verify hosted-service secret handling and sandbox regressions.
