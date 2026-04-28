---
phase: 2
title: Tenant Isolation And Audit Hardening
status: discussed
created: 2026-04-29
requirements:
  - SEC-02
  - SEC-03
  - SEC-04
  - TST-01
depends_on:
  - 01-contracts-config-and-auth-foundation
---

# Phase 2 Context: Tenant Isolation And Audit Hardening

## Goal

Verify and enforce tenant scoping across DB-backed resources, storage keys,
container metadata, privileged-action audit logging, and regression tests.

The phase should make tenant isolation visible at the side-effect boundary:
queries that mutate or read private resources, storage/object keys, host runtime
paths, Docker labels, hosted app labels, and audit rows.

## Locked Decisions

- The current milestone keeps the single-user tenant model. Do not introduce an
  organization/RBAC model unless existing code already requires it.
- `userId` and `workspaceId` are the primary tenant boundary for this phase.
- Preserve current public route shapes unless a route is demonstrably unsafe.
- Prefer narrow scoped query updates over broad repository extraction.
- Avoid schema changes unless they are necessary for tenant ownership or audit
  evidence.
- Do not add an API gateway; services remain independent Fastify services.
- Audit entries must avoid session cookies, provider keys, plaintext credentials,
  request bodies, file contents, and other sensitive values.

## Phase 1 Foundation Available

- Shared session validation now lives in `@pcp/db/src/session`.
- Shared API error envelopes live in `@pcp/shared/src/errors`.
- Production dummy-secret guards were tightened in the Phase 1 service slice.
- Publish service has the first shared error/logging/health/shutdown slice.

## Gray Areas Resolved

| Area                  | Resolution                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| Query audit breadth   | Use a risk-based pass over runtime, publish, workspace, and agent channel flows first.                |
| Storage compatibility | New keys must be tenant-prefixed; existing snapshot rows should remain readable where practical.      |
| Container metadata    | Add tenant labels to runtime and publish containers rather than changing route contracts.             |
| Audit coverage        | Add coverage for privileged lifecycle, file, command, snapshot, and publish actions in touched flows. |

## Out Of Scope

- Full row-level security migration.
- Organization-level RBAC design.
- Broad service repository refactor.
- MicroVM, gVisor, Kata, or Firecracker runtime migration.
- Metrics/tracing rollout beyond audit event hygiene.

## Success Definition

- Representative resource reads/writes enforce user/workspace ownership at the
  persistence boundary.
- Storage keys and host/container metadata include tenant identifiers and remain
  path traversal safe.
- Privileged side effects emit safe audit events.
- Regression tests fail if critical tenant predicates or tenant-prefixed storage
  contracts are removed.
