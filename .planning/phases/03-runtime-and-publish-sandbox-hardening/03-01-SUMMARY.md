---
phase: 3
plan: 03-01
subsystem: runtime sandbox
tags:
  - docker
  - sandbox
  - tests
requires:
  - 02-03
provides:
  - explicit-docker-sandbox-defaults
  - runtime-publish-sandbox-regression-tests
affects:
  - services/runtime/src/provider/docker.ts
  - services/runtime/src/provider/docker.test.ts
  - services/publish/src/service.ts
  - services/publish/src/service.test.ts
key-files:
  created: []
  modified:
    - services/runtime/src/provider/docker.ts
    - services/runtime/src/provider/docker.test.ts
    - services/publish/src/service.ts
    - services/publish/src/service.test.ts
key-decisions:
  - Keep runtime networking disabled while preserving publish networking through `pcp_network`.
  - Set memory swap equal to memory to avoid implicit swap expansion.
  - Add explicit Docker HostConfig booleans so defaults cannot drift silently.
requirements-completed:
  - SBOX-01
  - TST-01
duration: 0.2h
completed: 2026-04-29
---

# Phase 3 Plan 03-01: Harden Docker Provider Defaults Summary

Runtime and publish container launch configs now make the intended sandbox
defaults explicit and test-covered.

## What Changed

- Runtime Docker provider now sets:
  - `MemorySwap` equal to `Memory`
  - `Privileged: false`
  - `Init: true`
  - `OomKillDisable: false`
- Publish hosted containers now set the same explicit HostConfig hardening
  fields.
- Existing sandbox defaults remain in place: non-root user, read-only rootfs,
  dropped capabilities, pids limit, `no-new-privileges`, tmpfs `/tmp`, resource
  limits, and nofile ulimit.
- Runtime still uses `NetworkMode: none`.
- Publish still uses `NetworkMode: pcp_network` and a read-only workspace bind.
- Runtime and publish tests now fail if these explicit sandbox fields are
  removed.

## Verification

- RED confirmed:
  - `pnpm --filter @pcp/runtime-service test -- src/provider/docker.test.ts`
    failed before implementation on missing HostConfig fields.
  - `pnpm --filter @pcp/publish-service test -- src/service.test.ts` failed
    before implementation on missing HostConfig fields.
- GREEN confirmed:
  - `pnpm --filter @pcp/runtime-service test` passed.
  - `pnpm --filter @pcp/publish-service test` passed.
  - `pnpm test` passed.
  - `pnpm typecheck` passed.
  - `pnpm exec prettier --check` passed for touched code/test files.
  - `git diff --check` passed.

## Deviations from Plan

- `pnpm lint` still fails on pre-existing `apps/web` React lint errors outside
  this sandbox plan.

**Total deviations:** 1 known verification-scope deviation.
**Impact:** Runtime and publish sandbox code paths are covered; root lint remains
blocked by unrelated frontend debt.

## Next

Ready for 03-02: Add image and execution policy visibility.
