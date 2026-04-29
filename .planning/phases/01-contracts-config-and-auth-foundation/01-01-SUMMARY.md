---
phase: 1
plan: "01-01"
title: "Centralize Session And Env Validation"
status: completed
completed: 2026-04-28
---

# Summary: 01-01 Centralize Session And Env Validation

## Outcome

Created a shared DB-owned session validation helper and moved representative
protected services away from route-local session reads.

## Changes

- Added `packages/db/src/session.ts` with fail-closed session validation,
  typed session context, and shared user existence checks.
- Updated browser, agent automation/notifications/orchestrator, publish,
  memory, runtime, and workspace auth helpers to use the shared helper.
- Kept auth-service direct session reads in place because that service owns
  session lifecycle operations such as renewal, rotation, and logout.
- Added browser auth tests proving helper delegation and fail-closed missing
  sessions.
- Added browser env test proving dummy production secrets are rejected without
  exposing the secret value.
- Aligned unsafe production value detection for browser, memory, publish,
  runtime, and workspace env modules.

## Verification

- RED: `pnpm --dir services/browser exec vitest run src/auth.test.ts`
  failed before helper delegation.
- GREEN: `pnpm --dir services/browser exec vitest run src/env.test.ts src/auth.test.ts`
  passed.
- `pnpm typecheck` passed.
- `pnpm test` passed.

## Deviations From Plan

Auth service session DB access was intentionally left local because those
methods mutate session state, not just validate a cookie.

## Self-Check: PASSED
