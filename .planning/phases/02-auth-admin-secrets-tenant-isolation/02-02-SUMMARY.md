---
phase: 02-auth-admin-secrets-tenant-isolation
plan: 02
subsystem: publish
tags: [tenant-isolation, fastify, session-auth]
requires:
  - phase: 01-baseline-health-and-runtime-config
    provides: publish env validation and smoke baseline
provides:
  - publish routes derive user identity from session cookies
  - frontend hosting calls no longer send `userId`
  - route tests for spoofed publish `userId` inputs
affects: [publish, hosting, frontend, tenant-isolation]
tech-stack:
  added: []
  patterns:
    - browser-facing routes must derive `userId` from session context
key-files:
  created:
    - services/publish/src/routes.test.ts
  modified:
    - services/publish/src/routes.ts
    - services/publish/src/service.ts
    - services/publish/vitest.config.ts
    - apps/web/src/app/(main)/hosting/page.tsx
key-decisions:
  - 'Publish service keeps `userId` as an internal service parameter, but route schemas no longer accept it from clients.'
patterns-established:
  - 'Route tests can inject spoofed `userId` fields and assert service calls use the session user.'
requirements-completed: [TENANT-01]
requirements-advanced: [TENANT-02, TENANT-03]
duration: same-session
completed: 2026-04-27
---

# Phase 2 Plan 02 Summary

**Publish APIs no longer trust client-supplied user identity.**

## Accomplishments

- Added publish session validation against the `sessions` table.
- Removed `userId` from publish create/list/update/delete/start/stop/restart public route contracts.
- Updated the hosting page to stop sending `userId` to publish APIs.
- Added publish route tests covering spoofed `userId`, missing sessions, expired sessions, and lifecycle calls.
- Removed a touched `any` path in publish container error handling.

## Verification

- `pnpm --filter @pcp/publish-service typecheck` passed.
- `pnpm --filter @pcp/publish-service test` passed.
- `pnpm --filter web typecheck` passed.
- Final `pnpm smoke:local` passed.
