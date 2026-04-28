---
phase: 1
plan: "01-03"
title: "Normalize Logging Health And Shutdown"
status: completed
completed: 2026-04-28
---

# Summary: 01-03 Normalize Logging Health And Shutdown

## Outcome

Improved observability foundations on the publish service and removed a
session-cookie logging leak from the workspace service.

## Changes

- Added publish Fastify error mapping to the shared API error envelope, with
  safe internal-error messages and correlation IDs.
- Added publish `x-correlation-id` response propagation.
- Added publish logger base service context and redaction for authorization,
  cookie, internal token, credential, and hosted env-var fields.
- Added publish health response uptime and graceful shutdown that stops the
  hosted-service health daemon before closing Fastify.
- Removed the publish health daemon's direct `console.warn` URL logging.
- Removed workspace partial session-cookie logging during cookie validation.

## Verification

- `pnpm --filter @pcp/publish-service typecheck` passed.
- `pnpm --filter @pcp/workspace-service typecheck` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed.

## Deviations From Plan

The logging and error-handler pattern is implemented on publish as the first
service slice. Applying the same handler/redaction pattern to every service is
tracked as a remaining rollout item instead of broadening this change.

## Self-Check: PASSED
