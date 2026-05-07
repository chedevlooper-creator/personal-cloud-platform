# Phase 1: Error Envelope Hardening — PLAN.md

**Phase:** 1  
**Goal:** All services return typed error envelopes with no upstream/driver leakage.  
**Requirements:** SEC-01, SEC-02  
**Status:** Ready for execution

---

## 1. Overview

### 1.1 Problem
- Services throw plain `Error` for client-correctable failures (not-found, validation, conflict), which become 500 responses.
- Custom catch blocks in browser and datasets routes leak raw 500 error messages to clients.
- No consistent domain error taxonomy across services.

### 1.2 Solution
Introduce a centralized `DomainError` hierarchy in `@pcp/shared`, migrate runtime/publish/agent services to use it, and harden browser/datasets route catch blocks to suppress 500 details.

### 1.3 Success Criteria
- [ ] `DomainError` hierarchy exists in `@pcp/shared` with `NotFoundError`, `ValidationError`, `ConflictError`, `QuotaExceededError`.
- [ ] runtime, publish, agent services throw domain errors instead of plain `Error` for 4xx cases.
- [ ] browser/datasets routes never send raw `err.message` on 500 responses.
- [ ] At least one error-path test per scoped service confirms the public envelope.
- [ ] `toastApiError` remains the single frontend sink (no frontend changes needed).
- [ ] `pnpm typecheck` passes across all packages.
- [ ] `pnpm test` passes in modified services.

---

## 2. Architecture

### 2.1 DomainError Hierarchy

```
DomainError (abstract, extends Error)
├── statusCode: number
├── code: ApiErrorCode
├── message: string
├── NotFoundError (404)
├── ValidationError (400)
├── ConflictError (409)
├── QuotaExceededError (413)
└── [future: ForbiddenError, UnauthorizedError, etc.]
```

- `DomainError` captures `statusCode` and `code` so route catch blocks can call `sendApiError` without re-mapping.
- All subclasses set their canonical `ApiErrorCode` in the constructor.
- `WorkspaceError` in `services/workspace/src/service.ts` stays untouched (separate, working pattern).

### 2.2 Integration with Existing Infrastructure

- `createApiErrorHandler()` (global Fastify error handler) already sanitizes 500s — this is the safety net.
- `sendApiError()` is used by routes for explicit early-return errors.
- Custom `try/catch` blocks in routes bypass the global handler — these are the leakage vectors we fix.

### 2.3 Error Flow

```
Repository (pg/drizzle/redis/MinIO error)
    ↓ wrap
DomainError (or subclass)
    ↓ thrown
Service Layer (business logic, sees only DomainError)
    ↓ thrown
Route Handler (try/catch)
    ↓ instanceof DomainError ? sendApiError(...) : throw error
    ↓ (if uncaught)
createApiErrorHandler() (sanitizes 500s)
    ↓
{ error: { code, message, correlationId } }
```

---

## 3. Task Breakdown

### Task 1.1 — Add DomainError hierarchy to `@pcp/shared`
**Files:** `packages/shared/src/errors.ts`, `packages/shared/src/index.ts`  
**Effort:** small  
**Acceptance Criteria:**
- [ ] `DomainError` abstract class with `statusCode`, `code`, `message`.
- [ ] `NotFoundError`, `ValidationError`, `ConflictError`, `QuotaExceededError` subclasses.
- [ ] Each subclass constructor accepts `(message: string)` and sets canonical `statusCode` + `code`.
- [ ] Exported from `@pcp/shared` index.
- [ ] Audit `apiErrorCodeSchema` and `apiErrorCodeFromStatus` in `packages/shared/src/errors.ts` — add `'CONFLICT'` and `'QUOTA_EXCEEDED'` to the union and mapping if missing.
- [ ] `pnpm typecheck` passes.

### Task 1.2 — Add domain error tests for `@pcp/shared`
**Files:** `packages/shared/src/errors.test.ts` (new), `packages/shared/package.json`  
**Effort:** small  
**Acceptance Criteria:**
- [ ] Tests verify each subclass has correct `statusCode` and `code`.
- [ ] Tests verify `instanceof DomainError` works for all subclasses.
- [ ] Tests verify `instanceof Error` works (backward compatibility).
- [ ] Add `test` script to `packages/shared/package.json` (e.g., `"test": "vitest run"`) if missing.

### Task 1.3 — Wrap driver errors in runtime repository
**Files:** `services/runtime/src/service.ts` (or repository layer if exists)  
**Effort:** medium  
**Acceptance Criteria:**
- [ ] Replace `throw new Error('Workspace not found')` with `throw new NotFoundError('Workspace not found')`.
- [ ] Replace `throw new Error('Runtime or container not found')` with `throw new NotFoundError(...)`.
- [ ] Replace `throw new Error('Runtime not running or container not found')` with appropriate domain error.
- [ ] Any DB/driver errors caught and re-thrown as `DomainError` with appropriate code.

### Task 1.4 — Wrap driver errors in publish repository
**Files:** `services/publish/src/service.ts`, `services/publish/src/workspace-client.ts`, `services/publish/src/workspace-materializer.ts`  
**Effort:** medium  
**Acceptance Criteria:**
- [ ] Replace `throw new Error('Failed to create hosted service')` with `throw new ConflictError(...)` or `ValidationError(...)` as appropriate.
- [ ] Replace `throw new Error('Service not found')` with `throw new NotFoundError(...)`.
- [ ] Replace `throw new Error('Invalid hosted service slug')` with `throw new ValidationError(...)`.
- [ ] `WorkspaceClientError` — decide if it should extend `DomainError` or be wrapped at call sites.

### Task 1.5 — Wrap errors in agent orchestrator
**Files:** `services/agent/src/orchestrator.ts`  
**Effort:** medium  
**Acceptance Criteria:**
- [ ] Replace `throw new Error('Conversation not found')` with `throw new NotFoundError(...)`.
- [ ] Replace `throw new Error('Task not found')` with `throw new NotFoundError(...)`.
- [ ] Replace `throw new Error('Task already in final state')` with `throw new ConflictError(...)`.
- [ ] Replace `throw new Error('Tool approval expired')` with `throw new ValidationError(...)` or `ConflictError(...)`.
- [ ] Ensure `failTaskFromError` still receives the original error for logging.

### Task 1.6 — Harden browser route error handling
**Files:** `services/browser/src/routes.ts`  
**Effort:** small  
**Acceptance Criteria:**
- [ ] `handle()` helper checks `mapped.statusCode >= 500`.
- [ ] If 500, sends `defaultApiErrorMessage('INTERNAL_ERROR')` instead of `err?.message`.
- [ ] If 4xx, sends `err?.message` or fallback (already safe).
- [ ] Add test verifying 500 response has generic message.

### Task 1.7 — Harden datasets route error handling
**Files:** `services/workspace/src/routes/datasets.ts`  
**Effort:** small  
**Acceptance Criteria:**
- [ ] All 5 catch blocks check `status >= 500` before using `err?.message`.
- [ ] If 500, send `defaultApiErrorMessage('INTERNAL_ERROR')`.
- [ ] If 4xx, send `err?.message` (already safe).
- [ ] Add test verifying 500 response has generic message.

### Task 1.8 — Add service-level error envelope tests
**Files:**  
- `services/runtime/src/error-envelope.test.ts` (new)
- `services/publish/src/error-envelope.test.ts` (extend existing)
- `services/agent/src/orchestrator.error.test.ts` (new)
- `services/browser/src/routes.error.test.ts` (new)
- `services/workspace/src/datasets/error-envelope.test.ts` (new)

**Effort:** large  
**Acceptance Criteria:**
- [ ] At least one test per service asserting that a domain error produces the correct `{ error: { code, message } }` envelope.
- [ ] At least one test per service asserting that a 500 error produces generic "Internal server error" (not raw driver message).
- [ ] Tests use the actual Fastify app instance (not mocked), or mock at the appropriate layer.

### Task 1.9 — Update workspace routes to use `DomainError`
**Files:** `services/workspace/src/routes.ts`  
**Effort:** small  
**Acceptance Criteria:**
- [ ] Add `instanceof DomainError` check alongside existing `instanceof WorkspaceError` — do NOT remove `WorkspaceError` handling.
- [ ] Import `DomainError` from `@pcp/shared`.
- [ ] Verify `pnpm typecheck` passes.

### Task 1.10 — Run full verification suite
**Effort:** small  
**Acceptance Criteria:**
- [ ] `pnpm typecheck` passes across all packages.
- [ ] `pnpm test` passes in modified services.
- [ ] `pnpm lint` passes (if applicable).
- [ ] `pnpm smoke:local` passes (if applicable).

---

## 4. Implementation Details

### 4.1 DomainError Class Design

```typescript
// packages/shared/src/errors.ts

export abstract class DomainError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: ApiErrorCode;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // Fix prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly code: ApiErrorCode = 'NOT_FOUND';
}

export class ValidationError extends DomainError {
  readonly statusCode = 400;
  readonly code: ApiErrorCode = 'VALIDATION_ERROR';
}

export class ConflictError extends DomainError {
  readonly statusCode = 409;
  readonly code: ApiErrorCode = 'CONFLICT';
}

export class QuotaExceededError extends DomainError {
  readonly statusCode = 413;
  readonly code: ApiErrorCode = 'QUOTA_EXCEEDED';
}
```

**Note on `Object.setPrototypeOf`:** Required in TS when extending built-in classes like `Error` to ensure `instanceof` works correctly across transpilation targets.

### 4.2 Repository Layer Wrapping

```typescript
// Example pattern for repository functions

import { NotFoundError, DomainError } from '@pcp/shared';

async function getWorkspaceById(id: string, userId: string) {
  try {
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, id),
    });
    if (!workspace) {
      throw new NotFoundError('Workspace not found');
    }
    // Verify ownership
    if (workspace.userId !== userId) {
      throw new NotFoundError('Workspace not found'); // 404 to avoid enumeration
    }
    return workspace;
  } catch (error) {
    if (error instanceof DomainError) throw error;
    // Unexpected errors bubble up to createApiErrorHandler (500)
    throw error;
  }
}
```

### 4.3 Service Layer Usage

```typescript
// services/runtime/src/service.ts (example)

import { NotFoundError, DomainError } from '@pcp/shared';

class RuntimeService {
  async getRuntime(userId: string, workspaceId: string) {
    const runtime = await this.repo.findByWorkspaceId(workspaceId);
    if (!runtime) {
      throw new NotFoundError('Runtime not found');
    }
    if (runtime.userId !== userId) {
      throw new NotFoundError('Runtime not found');
    }
    return runtime;
  }
}
```

### 4.4 Route Handler Catch Pattern

```typescript
// Pattern for route handlers (replaces existing WorkspaceError catch)

import { DomainError, sendApiError, apiErrorCodeFromStatus } from '@pcp/shared';

try {
  return await service.someAction(...);
} catch (error) {
  if (error instanceof DomainError) {
    return sendApiError(reply, error.statusCode, error.code, error.message);
  }
  // Let unexpected errors bubble to createApiErrorHandler
  throw error;
}
```

### 4.5 Browser Route Fix

```typescript
// services/browser/src/routes.ts

function handle(err: any, reply: any, fallback = 'Internal error') {
  const mapped = browserRouteErrorCodeFromStatus(err?.statusCode ?? 500);
  if (mapped.statusCode >= 500) {
    fastify.log.error({ err }, 'browser route failed');
    return sendApiError(
      reply,
      mapped.statusCode,
      mapped.code,
      defaultApiErrorMessage('INTERNAL_ERROR')
    );
  }
  return sendApiError(
    reply,
    mapped.statusCode,
    mapped.code,
    err?.message ?? fallback
  );
}
```

### 4.6 Datasets Route Fix

```typescript
// services/workspace/src/routes/datasets.ts

} catch (err: any) {
  const status = err?.statusCode ?? 500;
  if (status === 500) {
    fastify.log.error({ err }, 'dataset query failed');
    return sendApiError(
      reply,
      status,
      apiErrorCodeFromStatus(status),
      defaultApiErrorMessage('INTERNAL_ERROR')
    );
  }
  return sendApiError(
    reply,
    status,
    apiErrorCodeFromStatus(status),
    err?.message ?? 'Query failed'
  );
}
```

---

## 5. Testing Strategy

### 5.1 Unit Tests (per service)
- Mock repository to throw `NotFoundError`, verify route returns 404 with correct envelope.
- Mock repository to throw plain `Error`, verify route returns 500 with generic message.
- Test `DomainError` subclasses in `@pcp/shared`.

### 5.2 Integration Tests
- Start actual Fastify app with `createApiErrorHandler`.
- Hit endpoint that triggers domain error, verify response shape.
- Hit endpoint that triggers 500, verify message is generic.

### 5.3 Test Locations
- `@pcp/shared`: `packages/shared/src/errors.test.ts`
- `runtime`: `services/runtime/src/error-envelope.test.ts`
- `publish`: `services/publish/src/error-envelope.test.ts` (extend existing)
- `agent`: `services/agent/src/orchestrator.error.test.ts`
- `browser`: `services/browser/src/routes.error.test.ts`
- `datasets`: `services/workspace/src/routes/datasets.error.test.ts`

---

## 6. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| `instanceof` fails across package boundaries | Use `Object.setPrototypeOf` in constructor; test `instanceof` in `@pcp/shared` tests |
| WorkspaceError conflicts with DomainError | Keep `WorkspaceError` as-is in workspace service; routes check both `instanceof` types during transition |
| Agent orchestrator has many `throw new Error` | Tackle incrementally: not-found first, then validation, then conflict |
| Tests fail due to vitest version split | Auth/workspace use vitest v4, others use v1 — write tests using common syntax (no v4-only APIs) |
| Breaking change to frontend | No frontend changes needed — `toastApiError` already handles the envelope |

---

## 7. Dependencies

- None (Phase 1 — no prior phase dependencies).
- **Downstream impact:** Phases 2-7 will benefit from typed errors.

---

## 8. Verification

Run these commands to verify completion:

```bash
# Typecheck everything
pnpm typecheck

# Test modified services
pnpm --filter @pcp/runtime-service test
pnpm --filter @pcp/publish-service test
pnpm --filter @pcp/agent-service test
pnpm --filter @pcp/workspace-service test
pnpm --filter @pcp/browser-service test

# Lint (if applicable)
pnpm lint

# Smoke test
pnpm smoke:local
```

**Manual verification:**
- [ ] Hit a runtime endpoint that triggers "not found" → verify 404 with `{ error: { code: "NOT_FOUND" } }`.
- [ ] Hit a browser endpoint that triggers 500 → verify response message is "Internal server error" (not raw error).
- [ ] Hit a datasets endpoint that triggers 500 → verify same.
- [ ] Open frontend, trigger an API error → verify `toastApiError` renders the envelope correctly (message + correlationId).

---

## 9. Rollback Plan

If issues arise:
1. Revert `@pcp/shared` changes — `WorkspaceError` still works independently.
2. Revert service changes individually (each service is independent).
3. No DB migration needed — this is purely code change.

---

*Plan created: 2026-05-06*  
*Based on: 01-CONTEXT.md, REQUIREMENTS.md (SEC-01, SEC-02), ROADMAP.md*
