---
phase: 5
plan: 01
name: tenant-isolation-audit
objective: Audit and fix all database queries and storage paths to ensure tenant scoping by user_id or organization_id
gap_closure: true
autonomous: true
wave: 1
cross_ai: false
files_modified:
  - services/auth/src/**/*.ts
  - services/workspace/src/**/*.ts
  - services/runtime/src/**/*.ts
  - services/agent/src/**/*.ts
  - services/memory/src/**/*.ts
  - services/publish/src/**/*.ts
  - services/browser/src/**/*.ts
---

# Plan 05-01: Tenant Isolation Audit

## Objective

Every resource query and storage path must be tenant-scoped by `user_id` or `organization_id`. Audit all 7 services for missing tenant filters and fix any gaps.

## Background

From `AGENTS.md`:
> Every query must filter by `user_id` or `organization_id`. Storage paths are tenant-prefixed.
> Service methods generally accept `userId` and resource IDs, but coverage is uneven and should be audited before production.

Known gap: `recoverInterruptedWork()` in `orchestrator.ts` queries tasks by status without `user_id` filter (though updates include it).

## Tasks

### Task 1: Create audit script (1h)

Create `scripts/audit-tenant-isolation.ts`:

```ts
// Scans all service source files for db.query and db.update patterns
// Reports queries missing user_id / organization_id filters
```

Use `grep` to find all `db.query.*findFirst`, `db.query.*findMany`, `db.update`, `db.delete` calls in `services/*/src/**/*.ts`.

### Task 2: Fix auth service (0.5h)

Verify all auth queries include tenant scope:
- User lookups by email
- Session lookups
- OAuth account lookups

### Task 3: Fix workspace service (0.5h)

Verify file metadata queries include `workspace_id` + `user_id`.

### Task 4: Fix agent service (1h)

Known issues:
- `recoverInterruptedWork()` — add `user_id` to the initial `findMany` queries
- `getConversations` — verify filter
- `getMessages` — verify conversation ownership check
- `chat()` — no userId for unauthenticated chat (expected, but document)

### Task 5: Fix remaining services (1h)

- runtime, memory, publish, browser

### Task 6: Add tenant-scoping tests (1h)

Add test cases that verify:
- User A cannot read User B's tasks
- User A cannot read User B's files
- User A cannot read User B's conversations

## Success Criteria

- [ ] Audit script runs and reports 0 unscoped queries
- [ ] All service methods accept `userId` and filter queries
- [ ] New tests verify cross-tenant access is blocked
- [ ] `pnpm test` passes in all services

## Deviations

Some queries are intentionally unscoped (e.g., automation worker reading tasks by ID after validating ownership). Document these exceptions inline.
