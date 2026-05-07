# Phase 2: Auth Normalization — PLAN.md

**Phase:** 2  
**Goal:** Internal service-to-service auth is scoped; workspace routes use one auth helper.  
**Requirements:** SEC-03, SEC-04  
**Status:** Ready for execution

---

## 1. Overview

### 1.1 Problem
- A single `INTERNAL_SERVICE_TOKEN` + arbitrary `X-User-Id` allows any compromised service to impersonate any user (SEC-03).
- Snapshot routes use `validateUserFromCookie` only, while other workspace routes use `resolveAuthenticatedUserId` (cookie + internal token + Supabase). This inconsistency means snapshot routes cannot receive internal service calls (SEC-04).

### 1.2 Solution
Add audience scoping via `X-Service-Audience` header. Each caller identifies itself. Receivers verify the audience against an allow-list. Unify snapshot routes onto `resolveAuthenticatedUserId`.

### 1.3 Success Criteria
- [ ] `resolveAuthenticatedUserId` rejects internal token calls without a valid `X-Service-Audience` in production.
- [ ] Snapshot routes use `resolveAuthenticatedUserId` with `internalServiceToken` support.
- [ ] All internal HTTP clients send `X-Service-Audience` header.
- [ ] Audit log records audience for service-to-service calls.
- [ ] `pnpm typecheck` passes across all packages.
- [ ] `pnpm test` passes in modified services.

---

## 2. Architecture

### 2.1 Audience Scoping Flow

```
Caller Service (agent/runtime/publish)
    ↓
POST /workspaces/:id/files
Headers:
  Authorization: Bearer <INTERNAL_SERVICE_TOKEN>
  X-User-Id: <uuid>
  X-Service-Audience: agent
    ↓
Receiver Service (workspace)
    ↓
resolveAuthenticatedUserId(request, {
  internalServiceToken: env.INTERNAL_SERVICE_TOKEN,
  allowedAudiences: ['agent', 'runtime', 'publish'],
})
    ↓
Verify token → Verify audience in allowed list → Resolve userId
```

### 2.2 Backward Compatibility
- If `allowedAudiences` is undefined or empty, accept any audience (dev fallback).
- If `X-Service-Audience` is missing and `allowedAudiences` is set, reject in production (configurable).

---

## 3. Task Breakdown

### Task 2.1 — Add audience check to `resolveAuthenticatedUserId`
**Files:** `packages/db/src/auth-request.ts`  
**Effort:** small  
**Acceptance Criteria:**
- [ ] `ResolveAuthOptions` gains `allowedAudiences?: string[]`.
- [ ] When `internalServiceToken` matches, read `X-Service-Audience` header.
- [ ] If `allowedAudiences` is set and audience is not in list, return `null` (401).
- [ ] If `allowedAudiences` is not set, accept any audience (backward compat).
- [ ] Add tests for audience acceptance and rejection.

### Task 2.2 — Update workspace env schema with `ALLOWED_AUDIENCES`
**Files:** `services/workspace/src/env.ts`  
**Effort:** small  
**Acceptance Criteria:**
- [ ] Add `ALLOWED_AUDIENCES` env var (comma-separated string, optional).
- [ ] Parse into string array in env schema.

### Task 2.3 — Update workspace routes to pass `allowedAudiences`
**Files:** `services/workspace/src/routes.ts`, `services/workspace/src/routes/snapshots.ts`, `services/workspace/src/routes/datasets.ts`  
**Effort:** medium  
**Acceptance Criteria:**
- [ ] All `resolveAuthenticatedUserId` calls in workspace routes pass `allowedAudiences: env.ALLOWED_AUDIENCES`.
- [ ] Snapshot routes use `resolveAuthenticatedUserId` instead of `validateUserFromCookie`.
- [ ] Import `resolveAuthenticatedUserId` in snapshot routes.
- [ ] `authBypass` support preserved in snapshot routes.

### Task 2.4 — Update agent HTTP client with audience header
**Files:** `services/agent/src/clients/http.ts`  
**Effort:** small  
**Acceptance Criteria:**
- [ ] Add `X-Service-Audience: agent` header to all requests.
- [ ] Read service name from `env.SERVICE_NAME` or hardcode `'agent'`.

### Task 2.5 — Update runtime workspace client with audience header
**Files:** `services/runtime/src/workspaceClient.ts`  
**Effort:** small  
**Acceptance Criteria:**
- [ ] Add `X-Service-Audience: runtime` header to all requests.

### Task 2.6 — Update publish workspace client with audience header
**Files:** `services/publish/src/workspace-client.ts`  
**Effort:** small  
**Acceptance Criteria:**
- [ ] Add `X-Service-Audience: publish` header to all requests.

### Task 2.7 — Update other service routes that accept internal tokens
**Files:** `services/browser/src/routes.ts`, `services/agent/src/routes.ts`, `services/runtime/src/routes.ts`  
**Effort:** medium  
**Acceptance Criteria:**
- [ ] Each service's env schema gains `ALLOWED_AUDIENCES` (optional).
- [ ] Route auth resolution passes `allowedAudiences` where applicable.
- [ ] Services that only use cookie auth (no internal callers) skip this.

### Task 2.8 — Add audit logging for audience
**Files:** `packages/db/src/auth-request.ts` (or service-level audit emitters)  
**Effort:** small  
**Acceptance Criteria:**
- [ ] When internal token path succeeds, log audience to pino context (not audit DB — too noisy).
- [ ] Log format: `{ authType: 'internal', audience: 'agent', userId: '...' }`.

### Task 2.9 — Add tests for audience scoping
**Files:** `packages/db/src/auth-request.test.ts` (new or existing)  
**Effort:** medium  
**Acceptance Criteria:**
- [ ] Test: valid token + valid audience → resolves user.
- [ ] Test: valid token + invalid audience → returns null.
- [ ] Test: valid token + no audience + allowedAudiences set → returns null (or configurable).
- [ ] Test: valid token + no audience + no allowedAudiences → resolves user (backward compat).

### Task 2.10 — Run full verification suite
**Effort:** small  
**Acceptance Criteria:**
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes in modified services.
- [ ] `pnpm lint` passes.

---

## 4. Implementation Details

### 4.1 `resolveAuthenticatedUserId` Audience Check

```typescript
export interface ResolveAuthOptions {
  internalServiceToken?: string;
  allowedAudiences?: string[];
  authBypass?: boolean;
  bypassUserId?: string;
  supabaseAuth?: SupabaseAuthConfig;
}

// Inside resolveAuthenticatedUserId:
if (internalToken) {
  const auth = readHeader(request.headers, 'authorization');
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length).trim();
    if (token && constantTimeEquals(token, internalToken)) {
      const headerUserId = readHeader(request.headers, 'x-user-id');
      if (typeof headerUserId === 'string' && headerUserId.length > 0) {
        // Audience check
        const audience = readHeader(request.headers, 'x-service-audience');
        if (options.allowedAudiences && options.allowedAudiences.length > 0) {
          if (!audience || !options.allowedAudiences.includes(audience)) {
            return null; // Invalid or missing audience
          }
        }
        return verifyUserExists(headerUserId);
      }
    }
  }
}
```

### 4.2 Snapshot Route Auth Migration

```typescript
// In setupSnapshotRoutes:
import { resolveAuthenticatedUserId } from '@pcp/db/src/auth-request';
import { env } from '../env';

// Before:
const userId = await workspaceService.validateUserFromCookie(request.cookies.sessionId || '');

// After:
const userId = await resolveAuthenticatedUserId(request, {
  internalServiceToken: env.INTERNAL_SERVICE_TOKEN,
  authBypass: env.AUTH_BYPASS,
  allowedAudiences: env.ALLOWED_AUDIENCES,
});
```

### 4.3 HTTP Client Header Addition

```typescript
// In services/agent/src/clients/http.ts:
const headers: Record<string, string> = {
  Authorization: `Bearer ${env.INTERNAL_SERVICE_TOKEN}`,
  'X-User-Id': opts.userId,
  'X-Service-Audience': env.SERVICE_NAME ?? 'agent',
};
```

---

## 5. Testing Strategy

- Unit tests in `packages/db/src/auth-request.test.ts` for audience logic.
- Integration tests in workspace service verifying snapshot routes accept internal token.
- Manual verification: agent → workspace internal call with audience header succeeds.

---

## 6. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Missing audience header breaks existing dev flow | `allowedAudiences` undefined = accept any audience (backward compat) |
| Snapshot routes break after auth migration | Test all snapshot endpoints with cookie and internal token |
| Service name inconsistency | Hardcode service names in clients, don't rely on env |

---

## 7. Dependencies

- Phase 1 (Error Envelope Hardening) completed — typed errors available for 401 responses.

---

## 8. Verification

```bash
pnpm typecheck
pnpm test
pnpm lint
```

**Manual verification:**
- [ ] Agent service internal call to workspace includes `X-Service-Audience: agent`.
- [ ] Workspace rejects call without audience when `ALLOWED_AUDIENCES` is set.
- [ ] Snapshot route accepts internal token call.

---

*Plan created: 2026-05-06*  
*Based on: 02-CONTEXT.md, REQUIREMENTS.md (SEC-03, SEC-04), ROADMAP.md*
