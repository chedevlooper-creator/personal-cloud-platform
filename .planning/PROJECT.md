# CloudMind OS

## What This Is

CloudMind OS is a brownfield, multi-tenant personal AI cloud computer. Users get
persistent browser workspaces, file management, terminal access, AI agent tool
calling, automation scheduling, browser sessions, hosted apps, snapshots,
settings, and admin surfaces through a Next.js frontend backed by independent
Fastify services.

This milestone is not about inventing the product from scratch. It is about
making the existing product safer and more production-ready so users can run and
automate useful work without leaking tenant data, credentials, or host resources.

## Core Value

Users can safely run and automate useful work inside persistent cloud workspaces
without leaking tenant data, credentials, or host resources.

## Requirements

### Validated

- [x] pnpm workspace exists with `apps/*`, `services/*`, and `packages/*`.
- [x] Next.js 16 and React 19 web app exists in `apps/web`.
- [x] Seven Fastify services exist for auth, workspace, runtime, agent, memory,
  publish, and browser.
- [x] PostgreSQL/pgvector, Redis, MinIO, Traefik, and Mailhog local infra exists.
- [x] `@pcp/db` owns schema, migrations, seed, and DB client.
- [x] `@pcp/shared` provides source-only Zod DTOs with no build artifact.
- [x] Existing docs describe agent tools, BYOK, data model, production guidance,
  and current open work.

### Active

- [ ] Centralize and harden authentication/session validation across services.
- [ ] Enforce tenant scoping in every data, storage, runtime, and hosting path.
- [ ] Validate service environment configuration at startup and reject dummy
  production secrets.
- [ ] Standardize API error envelopes, logging fields, and audit coverage.
- [ ] Harden Docker runtime and publish sandboxes for untrusted execution.
- [ ] Make agent approvals, task durability, streaming, memory, and telemetry
  production-ready.
- [ ] Add CI, targeted test coverage, metrics, traces, and frontend polish.

### Out of Scope

- Replacing Docker with Firecracker/Kata in this milestone - Docker is the MVP
  boundary; this milestone hardens the abstraction and keeps a future migration
  path open.
- Rewriting the service architecture into a single API gateway - existing
  independent services are the chosen shape for now.
- Adding a `dist/` build contract for `@pcp/shared` - consumers import from
  source by design.
- Broad dependency unification, including Vitest versions - auth/workspace and
  other services intentionally differ today and should be upgraded deliberately.
- Product expansion beyond production-readiness - new user-facing modules should
  wait until safety, reliability, and delivery gates are stronger.

## Context

The repo is a TypeScript pnpm monorepo requiring Node.js 20+ and pnpm 9+.
Frontend code is in `apps/web` and uses Next.js 16, React 19, Tailwind v4,
shadcn/Base UI primitives, TanStack Query, Zustand, Monaco, and xterm.js.

Backend code is split across independent Fastify services under `services/*`.
Services import `@pcp/db` and `@pcp/shared`; DB ownership stays in
`packages/db`. `packages/shared` is intentionally source-only.

The strongest recurring risks in the docs are tenant isolation, Docker host
escape, duplicated auth/session logic, fallback secrets, ad hoc error responses,
type-system bypasses, uneven logging, agent durability gaps, missing CI, and
thin test coverage for frontend/shared/cross-service behavior.

There are stale-documentation conflicts. Current executable config wins over
older prose: root `package.json` includes `browser-service` and defines
`typecheck` across all packages; some `.planning/codebase` notes still mention
six services or a no-op typecheck.

## Constraints

- **Runtime**: Node.js 20+ and pnpm 9+ are required by package metadata.
- **Database**: PostgreSQL with pgvector is required because memory search uses
  `vector(1536)`.
- **Architecture**: DB schema and migrations stay in `packages/db`; services
  must not claim their own schema ownership.
- **Shared contracts**: `@pcp/shared` stays source-only with Zod as its runtime
  dependency.
- **Frontend**: Next.js 16 and React 19 differ from older conventions; consult
  local Next docs before routing, server component, or config changes.
- **Security**: Every resource operation must be tenant scoped and storage paths
  must be tenant-prefixed.
- **Sandbox**: Docker remains the current runtime boundary, but production work
  must reduce host escape and resource exhaustion risk.
- **Docs**: When docs conflict, trust executable config and source code first.
- **Workflow**: Repo instructions require GSD workflow artifacts before direct
  edits unless the user explicitly bypasses GSD.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep pnpm monorepo | Shared types and atomic cross-service changes are valuable. | Pending |
| Keep Drizzle as DB layer | SQL-first schema ownership already exists in `@pcp/db`. | Pending |
| Harden Docker before microVM migration | Docker is the current implementation and fastest path to safer MVP. | Pending |
| Keep pgvector for memory | Avoids a second vector database while scale is modest. | Pending |
| Treat GSD as production-readiness tracker | Existing codebase already exists; roadmap should focus on hardening and verification. | Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

After each phase transition:
1. Requirements invalidated? Move to Out of Scope with reason.
2. Requirements validated? Move to Validated with phase reference.
3. New requirements emerged? Add to Active.
4. Decisions to log? Add to Key Decisions.
5. What This Is still accurate? Update if drifted.

After each milestone:
1. Full review of all sections.
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state.

---
*Last updated: 2026-04-28 after GSD initialization from existing repo docs*
