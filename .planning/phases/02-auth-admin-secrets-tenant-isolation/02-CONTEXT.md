# Phase 2: Auth, Admin, Secrets, Tenant Isolation - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning
**Source:** Fresh source inspection after Phase 1 local smoke

<domain>

## Phase Boundary

This phase hardens identity and ownership behavior without changing the overall service topology. The goal is not full RBAC or org support; it is to make current single-user resources consistently derive identity from sessions, reject client-supplied identity spoofing, and avoid logging or returning sensitive data.

</domain>

<decisions>

## Implementation Decisions

### Admin Policy

- Admin routes must fail closed when no explicit admin policy is configured.
- `ADMIN_EMAIL` may remain the MVP admin policy, but absence of `ADMIN_EMAIL` must deny `/admin/*`.
- Admin checks should use typed request/reply objects and validated auth env rather than raw `process.env` checks scattered in routes.

### Tenant Identity

- Publish routes must derive `userId` from the authenticated session cookie instead of accepting `userId` in request bodies or query strings.
- Automation routes already read the session cookie, but update/delete/run/runs paths must scope by both `id` and authenticated `userId`.
- Client `userId` request fields should be removed from web hosting calls where the server can derive identity.

### Secrets And PII

- Auth logs and audit details should not include raw email addresses or session IDs.
- Provider credential responses must never expose `encryptedKey`, `iv`, or `authTag` through object spreading.
- Masked provider keys should be derived from plaintext before encryption on create and from non-secret metadata for list responses where possible. If no non-secret suffix exists yet, use a generic provider-specific mask rather than ciphertext suffixes.

### Testing

- Add route/service tests that fail for cross-user access before fixes and pass after fixes.
- Prefer mocked DB for route-level tenant tests because Docker is unavailable in this environment.
- Preserve existing smoke command as the phase-level verification gate.

### the agent's Discretion

- Small helper modules may be introduced when they reduce repeated auth/session code across a service.
- Response shape cleanup can be scoped to touched endpoints; full platform-wide `{ data, error, meta }` normalization is deferred.
- More complete RBAC, organizations, OAuth PKCE/state, and CSRF tokens are out of scope for this phase unless needed by the above fixes.

</decisions>

<canonical_refs>

## Canonical References

Downstream agents MUST read these before planning or implementing.

### Planning

- `.planning/REQUIREMENTS.md` — Phase 2 requirement IDs and traceability.
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, and canonical refs.
- `.planning/codebase/CONCERNS.md` — Reset findings that identified tenant/security gaps.
- `.planning/phases/01-baseline-health-and-runtime-config/01-02-SUMMARY.md` — Env validation patterns established in Phase 1.

### Rules

- `.cursor/rules/architecture.mdc` — Tenant scoping and service boundary invariants.
- `.cursor/rules/backend-standards.mdc` — Strict TypeScript, no `any`, Zod boundary validation.
- `.cursor/rules/security.mdc` — Auth, authorization, secret, PII, and logging requirements.

### Source

- `services/auth/src/routes/admin.ts` — Admin policy currently permissive when `ADMIN_EMAIL` is unset.
- `services/auth/src/routes/profile.ts` — Provider credential response and settings ownership routes.
- `services/auth/src/service.ts` — Auth audit logging and session handling.
- `services/agent/src/routes/automation.ts` — Automation tenant filters.
- `services/publish/src/routes.ts` — Client-supplied `userId` route contract.
- `services/publish/src/service.ts` — Hosted service ownership queries.
- `apps/web/src/app/(main)/hosting/page.tsx` — Frontend still sends `userId` to publish service.

</canonical_refs>

<specifics>

## Specific Ideas

- Add `ADMIN_EMAIL` to auth env validation as optional in development but fail closed in admin route when absent.
- Introduce `getAuthenticatedUser` or `getAuthenticatedUserId` helpers in auth/publish/agent route modules to remove repeated unsafe patterns.
- Add `and(eq(...id), eq(...userId))` to automation update/delete/run/runs DB paths.
- For publish create, build service input as `{ ...request.body, userId }` after auth.
- For publish update, avoid spreading `userId` into `.set()` by omitting identity from accepted body schema.
- Store provider key suffix in `metadata` at create time or return a generic `provider-****` mask.

</specifics>

<deferred>

## Deferred Ideas

- Organization roles and RBAC.
- OAuth PKCE/state hardening.
- CSRF protection for cookie-backed state-changing APIs.
- Internal service auth tokens.
- Full platform error envelope standardization.

</deferred>

---

_Phase: 02-auth-admin-secrets-tenant-isolation_
_Context gathered: 2026-04-27_
