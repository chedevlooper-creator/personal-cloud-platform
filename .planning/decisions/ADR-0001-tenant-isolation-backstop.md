# ADR-0001: Tenant Isolation Backstop

**Date:** 2026-05-07
**Status:** Accepted
**Phase:** 5 — Tenant Isolation Backstop

## Decision

Use an **audit-tests-only** tenant isolation backstop for v0.1 instead of enabling PostgreSQL RLS in this phase.

## Rationale

- The current database client is a shared Drizzle/postgres-js pool from `packages/db/src/client.ts`; services do not set per-request database session context.
- Tenant ownership is modeled mostly with `user_id`, while some child tables only carry parent IDs such as `workspace_id`, `runtime_id`, `task_id`, or `service_id`.
- Correct RLS would require request-scoped DB context, transaction discipline, policy design across parent-child tables, and fixtures for every service flow. That is larger than the Phase 5 hardening slice.
- A static + runtime audit backstop fits the current architecture and catches the production risk this phase targets: adding or modifying DB access without tenant filters.

## Consequences

- CI must fail when a new service module imports `db` directly without being added to the tenant-isolation audit inventory.
- Tenant-facing DB modules must demonstrate `userId` ownership filtering, parent ownership checks, or row-sourced background ownership before passing tests.
- RLS remains a future hardening option after the project introduces request-scoped DB context.

## Follow-Up Option

Revisit RLS when database access is centralized enough to set a trusted `app.current_user_id` or equivalent per request/transaction.
