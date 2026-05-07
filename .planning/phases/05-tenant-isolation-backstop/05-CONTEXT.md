# Phase 5: Tenant Isolation Backstop - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

## Phase Boundary

Tenant isolation must have a backstop beyond developer discipline in route/service code.

Requirements:
- SEC-06: Tenant isolation has DB-level backstop evaluation or audit tests.

## Implementation Decisions

### Backstop Strategy
- **D-01:** Use audit-tests-only for v0.1, not PostgreSQL RLS.
- **D-02:** Record the RLS vs audit-tests-only decision in `.planning/decisions/ADR-0001-tenant-isolation-backstop.md`.
- **D-03:** CI should fail when a new direct `db` service module is added without an explicit tenant-isolation audit entry.

### Audit Test Scope
- **D-04:** Static audit tests inspect service modules that import `db` from `@pcp/db/src/client`.
- **D-05:** Tenant-facing modules must show one of: direct `userId` filters, parent workspace ownership checks, or row-sourced background ownership.
- **D-06:** Intentional system-wide modules such as admin views, identity/session bootstrap, and background health scans must be explicitly allow-listed with rationale.

### Red-Team Runtime Check
- **D-07:** Add a route-level red-team test that authenticates as one user via a JWT-shaped bearer token and attempts to access another user's workspace.
- **D-08:** Expected result is `404`/not found and the service must query the workspace with the authenticated attacker's user id, never a client-supplied/victim id.

### Claude's Discretion
- Exact static audit inventory structure.
- Whether the red-team route test lives in `services/workspace` or a shared package, as long as it exercises a real service route.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture and Risk
- `.planning/codebase/ARCHITECTURE.md` — Data model and tenant isolation audit gap.
- `.planning/codebase/CONCERNS.md` — B6 tenant isolation concern and B3/B4 prior auth concerns.
- `.planning/ROADMAP.md` — Phase 5 success criteria.
- `.planning/decisions/ADR-0001-tenant-isolation-backstop.md` — Locked decision for audit-tests-only.

### Auth and Tenant Resolution
- `packages/db/src/auth-request.ts` — Cookie/internal/Supabase auth resolution.
- `packages/db/src/session.ts` — Session and user existence helpers.

### Tenant-Scoped Code Paths
- `services/workspace/src/routes.ts` — Workspace route auth and ownership handoff.
- `services/workspace/src/service.ts` — Workspace/files/snapshots tenant checks.
- `services/workspace/src/datasets/service.ts` — Dataset user scoping.
- `services/runtime/src/service.ts` — Runtime workspace ownership and runtime row filters.
- `services/publish/src/service.ts` — Hosted service user filters and workspace ownership.
- `services/agent/src/orchestrator.ts` — Agent task/conversation/tool-call tenant filters.
- `services/agent/src/routes/automation.ts` — Automation route and webhook tenant behavior.
- `services/memory/src/service.ts` — Memory user filters including raw SQL vector search.

## Existing Code Insights

### Reusable Assets
- Existing Vitest tests already mock Drizzle predicates with `{ type: 'eq' }` shapes in workspace service tests.
- Phase 2 added `resolveAuthenticatedUserId` audience scoping; Phase 5 can reuse it for forged-token route testing.

### Established Patterns
- Services pass authenticated `userId` into service/orchestrator methods.
- Child table access is commonly protected by checking parent workspace/service/task ownership first.
- Background workers/daemons may scan all rows, but they must derive the acting user from each row before mutating or dispatching work.

### Integration Points
- Add static audit tests to `packages/db` so root `pnpm test` runs the cross-service inventory.
- Add route red-team test to `services/workspace` because workspace IDs are the clearest tenant boundary.

## Specific Ideas

- Create `packages/db/src/tenant-isolation-audit.test.ts` with an explicit inventory of direct DB modules.
- Create `services/workspace/src/routes.tenant-isolation.test.ts` to assert forged bearer/JWT access to another user's workspace is rejected.
- Keep the test inventory intentionally explicit so new DB access requires review.

## Deferred Ideas

- Full PostgreSQL RLS policy implementation after request-scoped DB context exists.

---

*Phase: 5-Tenant Isolation Backstop*
*Context gathered: 2026-05-07*
