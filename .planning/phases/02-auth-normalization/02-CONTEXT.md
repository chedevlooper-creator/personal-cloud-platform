# Phase 2: Auth Normalization - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

## Phase Boundary

Internal service-to-service auth is scoped; workspace routes use one auth helper. Specifically:
- SEC-03: Internal service token has audience/service scoping (no broad impersonation).
- SEC-04: Workspace routes use the central auth helper consistently.

Scope: All services that make or receive internal service-to-service calls. Auth service itself is mostly a consumer (not a provider of internal calls), but its token validation logic may need updates.

## Implementation Decisions

### Internal Token Scope Mechanism
- **D-01:** Use `X-Service-Audience` header for token scoping. Each caller includes `X-Service-Audience: <caller-service-name>` (e.g., `agent`, `runtime`, `publish`).
- **D-02:** Receiver service verifies the audience against `env.ALLOWED_AUDIENCES` (comma-separated list) in `resolveAuthenticatedUserId`.
- **D-03:** If `ALLOWED_AUDIENCES` is not set, fall back to accepting any audience (backward compatible for dev).
- **D-04:** The existing `INTERNAL_SERVICE_TOKEN` is kept unchanged — no JWT conversion or per-service token proliferation.

### Workspace Route Auth Unification
- **D-05:** Snapshot routes in `services/workspace/src/routes/snapshots.ts` migrate from `workspaceService.validateUserFromCookie()` to `resolveAuthenticatedUserId()` with `internalServiceToken` and `authBypass` support.
- **D-06:** All workspace route groups (main, snapshots, datasets) use the same auth resolution path.
- **D-07:** `validateUserFromCookie` stays as a method on WorkspaceService for backward compat but is no longer used by routes.

### Service-to-Service Client Changes
- **D-08:** All internal HTTP clients send `X-Service-Audience` header with their service name.
- **D-09:** Clients to update: `services/agent/src/clients/http.ts`, `services/runtime/src/workspaceClient.ts`, `services/publish/src/workspace-client.ts`.
- **D-10:** Each service has `env.SERVICE_NAME` (or hardcoded name) used in the header.

### Audit Logging
- **D-11:** Service-to-service calls with internal token are logged to audit log with `audience` field.

### Claude's Discretion
- Exact env var name for service name (`SERVICE_NAME` vs hardcoded).
- Whether to add a `requireUser` Fastify decorator for cleaner route auth (can be deferred to Phase 7 cleanup).

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth Infrastructure
- `packages/db/src/auth-request.ts` — `resolveAuthenticatedUserId`, internal token validation, Supabase auth
- `packages/db/src/session.ts` — `validateSessionUserId`, `verifyUserExists`

### Service Clients
- `services/agent/src/clients/http.ts` — Internal HTTP client used by agent service
- `services/runtime/src/workspaceClient.ts` — Workspace HTTP client used by runtime service
- `services/publish/src/workspace-client.ts` — Workspace HTTP client used by publish service

### Audit
- `services/auth/src/routes.ts` — Audit log emission pattern

### Workspace Routes
- `services/workspace/src/routes.ts` — Main workspace routes using `resolveAuthenticatedUserId`
- `services/workspace/src/routes/snapshots.ts` — Snapshot routes using `validateUserFromCookie` (inconsistent)
- `services/workspace/src/service.ts` — `validateUserFromCookie` method

### Environment
- `services/*/src/env.ts` — Service env schemas

## Existing Code Insights

### Reusable Assets
- `resolveAuthenticatedUserId()` in `@pcp/db` — Already supports cookie + internal token + Supabase. We add audience check here.
- `emitAudit()` pattern in auth/workspace services.

### Established Patterns
- Internal clients send `Authorization: Bearer <INTERNAL_SERVICE_TOKEN>` + `X-User-Id: <uuid>`.
- Routes use `if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED')` pattern after auth resolution.

### Integration Points
- `resolveAuthenticatedUserId` is called by all workspace routes and some other service routes — changing it affects all services.
- Snapshot routes are registered in `services/workspace/src/index.ts` via `setupSnapshotRoutes(fastify, workspaceService)`.

## Specific Ideas

- For `resolveAuthenticatedUserId`: add audience parameter to `ResolveAuthOptions`:
  ```ts
  export interface ResolveAuthOptions {
    internalServiceToken?: string;
    allowedAudiences?: string[];
    // ...
  }
  ```
- For clients: add `Service-Audience` or `X-Service-Audience` header.
- For workspace snapshot routes: replace `workspaceService.validateUserFromCookie(request.cookies.sessionId || '')` with `resolveAuthenticatedUserId(request, { internalServiceToken: env.INTERNAL_SERVICE_TOKEN })`.

## Deferred Ideas

- `requireUser` Fastify decorator for cleaner route auth — belongs in Phase 7 cleanup or can be added here if scope allows.
- Per-service JWT tokens with `aud` claim — deferred in favor of simpler header approach.

---

*Phase: 2-Auth Normalization*
*Context gathered: 2026-05-06*
