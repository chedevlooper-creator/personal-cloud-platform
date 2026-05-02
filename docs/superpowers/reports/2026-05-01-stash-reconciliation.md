# Stash Reconciliation Report

Date: 2026-05-01

## Source State

- Current branch: `master`
- Upstream base after pull: `420ba3a fix: restore chat flow and provider setup`
- Local design commit: `958d235 docs: add production ux design`
- Stash inspected: `stash@{0}: codex-before-pull-2026-05-01`

## Classification

| Area                                                          | Current status                                                                                                                           | Decision                                                                                                            |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/errors.ts`                               | Current `HEAD` already includes `RATE_LIMITED`, canonical status mapping, default messages, `createApiErrorHandler`, and `sendApiError`. | Do not restore from stash. Keep current upstream implementation.                                                    |
| `services/agent/src/routes.ts` invalid attachment/input codes | Stash changed old custom codes to `BAD_REQUEST`; current `HEAD` no longer has those old custom codes.                                    | Do not restore the old chat route just for this fix.                                                                |
| `services/agent/src/routes.ts` SSE ownership/current state    | Current live SSE subscribes before proving task ownership and does not send current state before waiting for future events.              | Recover behavior through focused tests and a small route change.                                                    |
| `services/agent/src/env.test.ts` `AUTH_BYPASS` isolation      | Current tests do not force `AUTH_BYPASS=0`, so caller environment can affect production-guard expectations.                              | Recover the isolation fix and add an explicit production rejection test.                                            |
| `services/browser/vitest.config.ts`                           | Current config can discover parent Vite/PostCSS config.                                                                                  | Recover service-local root and disabled PostCSS discovery while preserving current test globals.                    |
| `services/browser/src/routes.ts`                              | Current handler maps 400/429 service errors to 500.                                                                                      | Recover mapping, using `RATE_LIMITED` for 429.                                                                      |
| `services/browser/src/service.ts` URL hardening               | Current tests cover common private ranges and IPv4-mapped IPv6. Stash contains additional special-use ranges.                            | Defer broader SSRF range expansion to the browser/runtime hardening plan unless browser tests reveal a current gap. |
| `services/publish/src/service.ts` created container cleanup   | Current code marks startup failure crashed but can leave a created container behind if `start()` or DB update fails.                     | Recover cleanup behavior through a regression test.                                                                 |
| `apps/web/**` lint-only tweaks                                | Stash contains minor web lint/style edits.                                                                                               | Do not restore unless a current lint run identifies the same issue.                                                 |

## Verification Target

The first implementation slice is complete when these commands pass:

```bash
corepack pnpm --filter @pcp/agent-service typecheck
corepack pnpm --filter @pcp/agent-service test
corepack pnpm --filter @pcp/browser-service typecheck
corepack pnpm --filter @pcp/browser-service test
corepack pnpm --filter @pcp/publish-service typecheck
corepack pnpm --filter @pcp/publish-service test
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
```
