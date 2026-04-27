---
phase: 02-auth-admin-secrets-tenant-isolation
plan: 01
subsystem: auth
tags: [admin, secrets, audit, provider-credentials]
requires:
  - phase: 01-baseline-health-and-runtime-config
    provides: auth env validation and local smoke baseline
provides:
  - fail-closed admin email policy
  - explicit provider credential response mapping
  - non-PII auth audit details for touched auth flows
affects: [auth, admin, settings, security]
tech-stack:
  added: []
  patterns:
    - route helpers should fail closed when security policy is not configured
key-files:
  created:
    - services/auth/src/__tests__/admin.test.ts
    - services/auth/src/__tests__/provider-credentials.test.ts
  modified:
    - services/auth/src/env.ts
    - services/auth/src/routes/admin.ts
    - services/auth/src/routes/profile.ts
    - services/auth/src/service.ts
key-decisions:
  - 'Missing `ADMIN_EMAIL` denies admin access instead of implicitly allowing every authenticated user.'
  - 'Provider credential DTOs are mapped explicitly and do not spread database rows.'
patterns-established:
  - 'Masked provider keys come from non-secret metadata or plaintext at create time, never ciphertext suffixes.'
requirements-completed: [AUTH-02, AUTH-03]
requirements-advanced: [AUTH-04, TENANT-03]
duration: same-session
completed: 2026-04-27
---

# Phase 2 Plan 01 Summary

**Auth admin access now fails closed and provider credential responses avoid encrypted secret material.**

## Accomplishments

- Added `ADMIN_EMAIL` to validated auth env and changed `/admin/*` to deny access when no admin policy is configured.
- Replaced provider credential response object spreading with explicit DTO mapping.
- Stored a non-secret key suffix in credential metadata for future masks and stopped deriving list masks from ciphertext.
- Removed raw email/session ID details from touched auth audit logs.
- Added auth tests for admin policy and provider credential response masking.

## Verification

- `pnpm --filter @pcp/auth-service typecheck` passed.
- `pnpm --filter @pcp/auth-service test` passed.
- Final `pnpm smoke:local` passed.

## Remaining Work

- Full platform-wide error envelope normalization remains open under AUTH-04.
- Broader cross-resource tenant denial coverage remains open under TENANT-03.
