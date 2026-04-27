# Phase 2 Research: Auth, Admin, Secrets, Tenant Isolation

**Researched:** 2026-04-27
**Mode:** Source-grounded implementation research

## Current State

- Auth service exposes `/auth/register`, `/auth/login`, `/auth/me`, `/auth/refresh`, `/auth/logout`, `/auth/oauth/google/*`, `/auth/user/*`, and `/auth/admin/*`.
- Session identity is stored in the `sessionId` cookie and backed by `sessions.userId`.
- Phase 1 added service env modules and validated cookie/encryption/OAuth values.
- Admin routes currently compare the authenticated user email to `process.env.ADMIN_EMAIL` only when it is set; if it is unset, any authenticated user passes.
- Provider credential routes spread DB rows into responses, which risks returning encrypted secret material unless Fastify response serialization strips it reliably.
- Publish routes accept `userId` in bodies/query strings, making ownership spoofable from the browser.
- Automation routes derive user from session but several operations query/update/delete by automation ID only.
- Auth service audit details include raw email and session IDs.

## Implementation Approach

### Auth/Admin

Use the existing `AuthService.validateSession` path to identify a user for admin checks. Add `ADMIN_EMAIL` to auth env validation and fail closed in the admin route when it is missing or does not match the authenticated user. Avoid logging email addresses in auth logs and audit details.

### Provider Credentials

Return DTOs explicitly instead of object spreading. Do not expose `encryptedKey`, `iv`, `authTag`, `keyVersion`, `metadata`, or `revokedAt`. On create, derive `maskedKey` from plaintext before encryption. On list, use `metadata.keySuffix` if present; otherwise return a generic provider mask so old rows do not reveal ciphertext suffixes.

### Publish Tenant Scope

Add a route-level session helper in publish service. Because publish currently imports DB and session schema indirectly through service patterns, the narrowest fix is a local helper that reads `sessionId`, validates expiry, and returns `session.userId`. Route schemas should remove `userId` from request body/query. Service methods can keep `userId` parameters internally, supplied by route auth context.

### Automation Tenant Scope

Keep the existing session-derived user helper but remove non-null assertions and scope all automation and run queries by `userId`. For workspace-specific list queries, include `workspaceId` filter only when present. Update/delete/run/runs must not operate on rows owned by another user.

### Tests

Use mocked `@pcp/db/src/client` for route/service tests so Docker is not required. Tests should cover:

- Admin route denies authenticated non-admin and denies all users when admin policy is unset.
- Publish route ignores client `userId` and uses session user for create/list/update/delete/start/stop/restart.
- Automation update/delete/run/runs cannot act on another user's automation.
- Provider credential responses omit encrypted material.

## Risks

- Fastify response serialization may already strip unknown fields, but explicit DTO mapping is safer and easier to test.
- Publish frontend currently sends `userId`; route changes require updating web hosting calls at the same time.
- `AuthService.validateSession` returns sanitized user including email; admin MVP still needs email comparison until a role column exists.
- Without Docker, migration-backed tests remain blocked; route-level mocked tests are the pragmatic Phase 2 coverage.

## Verification

- `pnpm --filter @pcp/auth-service test`
- `pnpm --filter @pcp/agent-service test`
- `pnpm --filter @pcp/publish-service test`
- `pnpm --filter web typecheck`
- `pnpm smoke:local`

## Plan Shape

- Plan 02-01: Auth/admin/provider credential hardening.
- Plan 02-02: Publish identity derivation and frontend request cleanup.
- Plan 02-03: Automation tenant filters and tests.

---

_Research completed: 2026-04-27_
