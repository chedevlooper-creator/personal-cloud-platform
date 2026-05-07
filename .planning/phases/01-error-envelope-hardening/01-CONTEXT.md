# Phase 1: Error Envelope Hardening - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

## Phase Boundary

All services return typed error envelopes with no upstream/driver leakage. Specifically:
- SEC-01: Domain errors (not-found, validation, conflict) are thrown as typed 4xx errors instead of plain `Error` that becomes 500.
- SEC-02: Custom catch paths in routes never leak raw 500 messages to clients.

Scope: runtime, publish, agent services + browser/datasets routes. Other services (auth, memory, workspace) already handle errors correctly via `sendApiError` / `WorkspaceError`.

## Implementation Decisions

### Error Class Taxonomy
- **D-01:** A single central hierarchy in `@pcp/shared`: `DomainError` base class with `statusCode` and `code`, plus subclasses like `NotFoundError`, `ValidationError`, `ConflictError`, `QuotaExceededError`.
- **D-02:** All scoped services import from `@pcp/shared`. No per-service error classes.
- **D-03:** `WorkspaceError` stays as-is in workspace service (it already works); new services use the shared hierarchy.

### 500 Message Policy
- **D-04:** All `statusCode >= 500` errors return generic "Internal server error" to clients. Details go to server logs only (pino with `correlationId`).
- **D-05:** Custom catch blocks in browser/datasets routes must check `statusCode >= 500` and suppress message before calling `sendApiError`.

### Migration Scope
- **D-06:** Scope is runtime, publish, agent services + browser/datasets routes. Auth, memory, workspace are out of scope for this phase.

### Driver Error Wrapping
- **D-07:** Repository layer wraps driver errors (pg, drizzle, redis, MinIO) into domain errors. Service layer sees only domain errors.
- **D-08:** If a repository function can return null (e.g., "not found"), it throws `NotFoundError` instead of returning null + service checking.

### Claude's Discretion
- Exact naming of error subclasses (e.g., `QuotaExceededError` vs `StorageQuotaError`) is flexible.
- Whether to add a `ForbiddenError` subclass or reuse `Forbidden` via `DomainError` directly.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Error Infrastructure
- `packages/shared/src/errors.ts` — Existing `createApiErrorHandler`, `sendApiError`, `apiErrorCodeFromStatus`, error envelope schemas
- `apps/web/src/lib/api.ts` — Frontend `ApiError` class and `toastApiError` consumer

### Audit Evidence
- `docs/superpowers/reports/2026-05-02-cloudmind-superpowers-gap-audit.md` §P1 Backend And Security — SEC-01, SEC-02 findings and evidence paths

### Service Patterns
- `services/workspace/src/service.ts` — `WorkspaceError` pattern (statusCode + message in constructor)
- `services/workspace/src/routes.ts` — Route-level `WorkspaceError` catch + `sendApiError` pattern
- `services/browser/src/routes.ts` — Custom `handle()` helper that leaks 500 messages (lines 44-48)
- `services/workspace/src/routes/datasets.ts` — Custom catch blocks that leak 500 messages (lines 81-88, 115-124, 147-156, 177-184, 246-254)

### Out-of-scope Services (for reference only)
- `services/auth/src/routes.ts` — Already uses `sendApiError` correctly
- `services/agent/src/routes.ts` — Already uses `sendApiError` for explicit 4xx paths; relies on `createApiErrorHandler` for 5xx

## Existing Code Insights

### Reusable Assets
- `createApiErrorHandler()` in `@pcp/shared` — Already installed on all 7 services. Correctly maps 5xx to generic message.
- `sendApiError()` in `@pcp/shared` — Used by routes for explicit error responses.
- `WorkspaceError` in `services/workspace/src/service.ts` — Pattern to replicate: constructor takes `(message, statusCode)`.

### Established Patterns
- Fastify routes use `try { ... } catch (error) { if (error instanceof WorkspaceError) { sendApiError(...) } else { throw error } }` — This pattern should be replaced with `instanceof DomainError` once the hierarchy exists.
- `createApiErrorHandler` is the global safety net — any error that escapes route handlers gets sanitized. Custom catch blocks bypass this safety net, which is the leakage vector.

### Integration Points
- New `@pcp/shared` error classes must be imported by: `services/runtime/src/`, `services/publish/src/`, `services/agent/src/orchestrator.ts`, `services/browser/src/routes.ts`, `services/workspace/src/routes/datasets.ts`.
- Frontend `toastApiError` in `apps/web/src/lib/api.ts` already handles the `{ error: { code, message, correlationId } }` envelope — no frontend changes needed unless new error codes are added.

## Specific Ideas

- For agent orchestrator: `throw new Error('Conversation not found')` → `throw new NotFoundError('Conversation not found')` (becomes 404 instead of 500).
- For browser routes: the `handle()` helper should check `mapped.statusCode >= 500` and pass `defaultApiErrorMessage('INTERNAL_ERROR')` instead of `err?.message`.
- For datasets routes: same fix — check `status >= 500` before using `err?.message`.

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 1-Error Envelope Hardening*
*Context gathered: 2026-05-06*
