---
phase: 1
plan: "01-02"
title: "Standardize API Errors And Shared DTO Contracts"
status: completed
completed: 2026-04-28
---

# Summary: 01-02 Standardize API Errors And Shared DTO Contracts

## Outcome

Added a shared API error envelope and migrated the publish route surface as the
initial vertical slice.

## Changes

- Added `packages/shared/src/errors.ts` with `apiErrorResponseSchema`,
  `ApiErrorCode`, `ApiErrorResponse`, and `createApiErrorResponse`.
- Exported the error contract from `packages/shared/src/index.ts` without
  adding a build or dist contract.
- Updated publish route 401 responses and response schemas to use the shared
  envelope.
- Updated the frontend API error parser to understand both legacy
  `{ error: string }` responses and the new `{ error: { message } }` envelope.
- Added a publish route test that fails if unauthenticated responses regress to
  the legacy string shape.

## Verification

- RED: `pnpm --dir services/publish exec vitest run src/routes.test.ts`
  failed before the publish 401 envelope migration.
- GREEN: `pnpm --dir services/publish exec vitest run src/routes.test.ts`
  passed.
- Touched files were searched for newly introduced `as any` and `z.any()`; none
  were introduced.
- `pnpm typecheck` passed.
- `pnpm test` passed.

## Deviations From Plan

The full cross-service error-envelope rollout remains a follow-up. This plan
established the shared contract and one tested service migration without
rewriting every route surface at once.

## Self-Check: PASSED
