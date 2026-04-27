# CloudMind OS - Personal AI Cloud Computer

## What This Is

CloudMind OS is a browser-based personal cloud computer for persistent workspaces, files, terminal/runtime execution, AI agent tasks, automations, hosting, snapshots, settings, and administration. The current repository already contains a Next.js frontend and multiple Fastify services, but this reset treats the existing code as a code-inferred MVP baseline that must be audited, hardened, and verified before it is considered complete.

## Core Value

A user can safely run and manage a persistent AI-assisted workspace in the browser without losing data, crossing tenant boundaries, or executing unapproved risky actions.

## Requirements

### Validated

Code-inferred existing capabilities, not yet UAT-validated in this reset:

- [x] User-facing app shell and protected routes exist in `apps/web`.
- [x] Email/password auth, session cookies, OAuth hooks, preferences, provider credentials, and admin routes exist in `services/auth`.
- [x] Workspace metadata and S3-backed file content paths exist in `services/workspace`.
- [x] Runtime container lifecycle code exists in `services/runtime`.
- [x] Agent task, conversation, tool-call, and automation skeletons exist in `services/agent`.
- [x] Memory, publish, snapshot, notification, terminal, and skill schema foundations exist in `packages/db`.

### Active

- [ ] Re-establish baseline correctness with builds, tests, migrations, and live-service smoke checks.
- [ ] Close security gaps around secrets, admin access, tenant scoping, and user spoofing.
- [ ] Turn workspace, runtime, agent, automation, hosting, and snapshot flows from MVP/simulated behavior into verified behavior.
- [ ] Align frontend modules with real backend behavior and remove misleading placeholder states.
- [ ] Add test coverage and GSD verification around critical user journeys.

### Out of Scope

- Native mobile apps - web-first until core workspace/runtime behavior is reliable.
- Billing and paid plans - not needed to validate the personal cloud workflow.
- Enterprise organization management - current schema is user-first and does not consistently model organizations.
- Public plugin/skill marketplace - internal skill storage can be stabilized first.
- Multi-region deployment - local Docker Compose and single-node reliability come first.

## Context

- Repo is a pnpm monorepo with `apps/*`, `services/*`, and `packages/*`.
- Frontend is Next.js 16 + React 19, so routing/config changes must follow local Next docs.
- Backend is split across independent Fastify services; there is no `apps/api`.
- Database schema is centralized in `packages/db`, but services directly import the shared DB client.
- Infrastructure stack is Postgres pgvector, Redis, MinIO, Traefik, and Mailhog.
- Old GSD plans were archived at `.planning/archive/legacy-20260427-reset/` and are no longer the active baseline.
- New codebase map is in `.planning/codebase/` and should be used for all future planning.

## Constraints

- **Tenant isolation**: Every data access path must be scoped by authenticated user or workspace ownership because this is a multi-tenant cloud workspace.
- **Security**: Secrets must come from env and production startup must fail closed; no default production keys.
- **Runtime safety**: Docker execution must enforce non-root, resource limits, network policy, and approval gates before it can be considered safe.
- **Service boundaries**: Keep current services independent; do not add a stale `apps/api` gateway assumption.
- **TypeScript**: Strict mode and `noUncheckedIndexedAccess` are active; new code must satisfy them without broad `any`.
- **Shared DTOs**: External HTTP inputs should use Zod schemas from `@pcp/shared` or local strict schemas.
- **Planning**: New work should trace to `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md`, not archived legacy plans.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Archive old GSD root artifacts and create a fresh planning baseline | User requested a clean start while preserving prior context | Pending |
| Treat current code as MVP baseline, not finished product | Source contains mocks, placeholders, and security gaps despite README completion claims | Pending |
| Prioritize hardening before feature expansion | Tenant isolation, secrets, and runtime safety are prerequisites for a personal cloud platform | Pending |
| Use interactive GSD with text mode | Codex default mode cannot use GSD's interactive menu tool; text-mode docs keep the workflow usable | Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition**:
1. Requirements invalidated? Move to Out of Scope with reason.
2. Requirements validated? Move to Validated with phase reference.
3. New requirements emerged? Add to Active.
4. Decisions to log? Add to Key Decisions.
5. "What This Is" still accurate? Update if drifted.

**After each milestone**:
1. Full review of all sections.
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state.

---
*Last updated: 2026-04-27 after clean GSD reset and codebase remap*

