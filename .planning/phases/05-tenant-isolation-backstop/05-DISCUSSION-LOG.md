# Phase 5: Tenant Isolation Backstop - Discussion Log

**Date:** 2026-05-07

## Decisions

- Chose audit-tests-only over PostgreSQL RLS for v0.1.
- RLS was deferred because the current shared Drizzle pool has no request-scoped DB session context and several tenant-owned child tables rely on parent ownership rather than direct `user_id` columns.
- The audit backstop will combine static inventory coverage with a runtime red-team route test.

## Notes

- The phase remains within SEC-06 because ROADMAP.md explicitly allows either RLS or audit-tests-only.
- The decision is recorded in `.planning/decisions/ADR-0001-tenant-isolation-backstop.md`.

## Deferred

- Revisit RLS when request-scoped DB context is available.
