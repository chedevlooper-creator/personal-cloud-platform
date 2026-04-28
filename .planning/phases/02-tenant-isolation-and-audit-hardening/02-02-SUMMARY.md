---
phase: 2
plan: 02-02
subsystem: tenant isolation
tags:
  - storage
  - docker
  - audit
requires:
  - 02-01
provides:
  - tenant-prefixed-snapshot-keys
  - runtime-tenant-host-paths
  - runtime-publish-container-labels
affects:
  - services/workspace/src/service.ts
  - services/workspace/src/routes/snapshots.ts
  - services/runtime/src/service.ts
  - services/runtime/src/provider/docker.ts
  - services/runtime/src/provider/types.ts
  - services/publish/src/service.ts
key-files:
  created: []
  modified:
    - services/workspace/src/service.ts
    - services/workspace/src/service.test.ts
    - services/workspace/src/routes/snapshots.ts
    - services/runtime/src/service.ts
    - services/runtime/src/service.test.ts
    - services/runtime/src/provider/docker.ts
    - services/runtime/src/provider/docker.test.ts
    - services/runtime/src/provider/types.ts
    - services/publish/src/service.ts
    - services/publish/src/service.test.ts
key-decisions:
  - Prefix new snapshot object keys with both user id and workspace id.
  - Prefix runtime host workspace paths with user id and workspace id.
  - Add non-sensitive `pcp.*` labels at runtime and publish container creation.
requirements-completed:
  - SEC-03
  - SEC-04
  - TST-01
duration: 0.4h
completed: 2026-04-29
---

# Phase 2 Plan 02-02: Harden Storage Paths Runtime Labels And Audit Coverage Summary

Tenant identity is now explicit in snapshot object keys, runtime host paths, and
runtime/publish container metadata.

## What Changed

- New snapshot artifact keys are shaped as
  `snapshots/{userId}/{workspaceId}/...`.
- Existing snapshot rows remain readable because restore reads the stored
  `storageKey` directly instead of recomputing it.
- Runtime host workspace paths now resolve under
  `{WORKSPACE_HOST_ROOT}/{userId}/{workspaceId}`.
- Runtime container creation now passes `pcp.service`, `pcp.userId`,
  `pcp.workspaceId`, and `pcp.runtimeId` labels to the Docker provider.
- Docker provider forwards safe runtime labels to `createContainer`.
- Publish service hosted-app volumes now use
  `/tmp/workspaces/{userId}/{workspaceId}` and include `pcp.service`,
  `pcp.userId`, `pcp.workspaceId`, and `pcp.hostedServiceId` labels.
- Snapshot route audit failure handling now uses `fastify.log.warn` instead of
  `console.error`, keeping audit failure details structured.

## Verification

- `pnpm --filter @pcp/workspace-service test` passed.
- `pnpm --filter @pcp/runtime-service test` passed.
- `pnpm --filter @pcp/publish-service test` passed.
- `pnpm test` passed.
- `pnpm typecheck` passed.
- `pnpm exec prettier --check` passed for touched code/test files.
- `git diff --check` passed.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0.
**Impact:** Storage paths and container metadata now expose tenant/resource
correlation without adding secrets or raw request payloads.

## Next

Ready for 02-03: Add tenant isolation regression tests.
