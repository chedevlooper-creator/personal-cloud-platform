# CloudMind OS - Personal AI Cloud Computer

## What This Is

CloudMind OS is a multi-tenant, browser-based personal AI cloud computer. Users get persistent workspaces, file management, an AI agent with tool calling, browser terminal access, automation scheduling, app hosting, snapshots, settings, and admin surfaces through a Next.js frontend backed by independent Fastify services.

This is a brownfield TypeScript pnpm monorepo: the major product modules already exist, but the implementation still needs production-readiness work around security hardening, tenant isolation, runtime sandboxing, agent durability, test coverage, and deployment reliability.

## Core Value

Users can safely run and automate useful work inside persistent cloud workspaces without leaking tenant data, credentials, or host resources.

## Requirements

### Validated

- [validated] Next.js app shell and main product pages exist for dashboard, files, chat, terminal, automations, hosting, snapshots, settings, admin, and related workspace surfaces.
- [validated] Users can register, log in, log out, refresh sessions, and use Google OAuth through the auth service.
- [validated] Sessions are persisted in PostgreSQL and transported through HTTP-only cookies.
- [validated] Workspace APIs support creating/listing/getting/deleting workspaces and file operations backed by database metadata plus S3-compatible object storage.
- [validated] Workspace path traversal protection has dedicated tests.
- [validated] Runtime service exposes Docker-backed runtime creation, start/stop/delete, command execution, logs/events, and terminal WebSocket attachment.
- [validated] Agent service stores tasks, task steps, conversations, tool calls, provider-backed LLM calls, and basic tool execution.
- [validated] Automations are modeled and queued through BullMQ/Redis.
- [validated] Memory service stores memory entries with pgvector embeddings and supports semantic search.
- [validated] Publish service can model hosted services and start Docker containers with Traefik routing labels.
- [validated] Settings/admin/provider credential schema exists, including AES-256-GCM encrypted credential storage.
- [validated] Local infrastructure exists for PostgreSQL pgvector, Redis, MinIO, Traefik, and Mailhog.
- [validated] Shared Zod DTOs exist in `packages/shared` and Drizzle owns schema/migrations in `packages/db`.

### Active

- [ ] Harden startup configuration so production services fail closed when required secrets and provider keys are missing.
- [ ] Audit and enforce tenant isolation across every DB read/write and file/storage path.
- [ ] Bring service implementation closer to the repo standard: route -> service -> repository, consistent typed errors, and consistent response envelopes.
- [ ] Harden auth and OAuth behavior against the security rules: state/PKCE, redirect allowlists, generic failures, cookie policy, and session lifetime.
- [ ] Harden runtime sandboxing beyond MVP Docker defaults: non-root user, read-only rootfs, capability drops, pids/disk/tmpfs limits, seccomp/apparmor, and command policy tests.
- [ ] Make agent execution durable and observable: approval enforcement, cancellation, retry/error semantics, token/cost accounting, and realtime task updates.
- [ ] Align frontend service routing, especially terminal WebSocket behavior, with the intended dev/production proxy model.
- [ ] Add integration and E2E coverage for critical user journeys and tenant isolation.
- [ ] Polish deployment assets: Dockerfiles, CI checks, migration flow, health/readiness checks, and production docs.

### Out of Scope

- A single `apps/api` gateway - this repo intentionally uses independent services under `services/*`.
- Organization/team tenancy - current scope is user/workspace tenancy unless a later milestone explicitly adds organizations.
- Billing, subscriptions, and payments - no payment code exists and it is not needed for the hardening milestone.
- Firecracker/Kata microVM runtime - documented as a V2 direction; current active work should harden the Docker abstraction first.
- Multi-host orchestration for hosted apps - current publish service is Docker/Traefik on one host; cluster scheduling is deferred.
- Replacing Drizzle/PostgreSQL/pgvector with another persistence stack - current architecture decisions intentionally choose these.

## Context

The repo is a pnpm workspace with `apps/web`, six Fastify services, `packages/db`, and `packages/shared`. The frontend is Next.js 16 and React 19, so routing/config changes must consult local Next docs as noted in `apps/web/AGENTS.md`.

Service boundaries are defined by `.cursor/rules/architecture.mdc`: auth, workspace, runtime, agent, memory, and publish are independent services. The backend is not a single gateway. Services should communicate through HTTP, Redis pub/sub, or queues, and DB access is centralized through `packages/db`.

The codebase already contains broad MVP feature coverage. `README.md` claims all nine original phases are implemented, while `docs/PROGRESS.md` still says the foundation phase is in progress and older `docs/BUILD_PLAN.md` mentions a stale `apps/api` gateway. Treat source code, package manifests, `AGENTS.md`, and `.cursor/rules/*` as more authoritative than stale prose.

The existing implementation is intentionally MVP-shaped in several places. Notable examples include dummy/fallback secrets, direct Drizzle access from service classes, many `any` casts around routes/provider boundaries, partial runtime sandbox controls, simulated agent command execution, and limited test coverage outside auth/workspace/memory/agent units.

## Constraints

- **Runtime**: Node.js 20+ and pnpm 9+ are required by root package metadata.
- **Database**: PostgreSQL with pgvector is required; memory service depends on vector support.
- **Architecture**: No cross-service DB ownership changes; schema and migrations stay in `packages/db`.
- **Frontend**: Next.js 16 and React 19 differ from older conventions; check `apps/web/node_modules/next/dist/docs/` before routing/config work.
- **Security**: Every resource query and storage path must be tenant scoped by user/workspace/organization context.
- **Sandbox**: Docker is the MVP runtime boundary; production-readiness work must reduce host escape and resource exhaustion risk before enabling untrusted execution broadly.
- **Docs**: `README.md` has stale areas; executable config and source code win over prose.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use pnpm workspaces | Shared packages and multiple services need one repo-level dependency graph. | Pending |
| Use independent Fastify services instead of `apps/api` | Service boundaries are already implemented under `services/*`. | Pending |
| Use Drizzle ORM and keep schema in `packages/db` | SQL-first type-safe schema and migrations are already established. | Pending |
| Use PostgreSQL with pgvector for memory | Keeps relational and vector data in one operational store for MVP. | Pending |
| Use Docker for MVP runtime and hosting | Faster to build and already implemented through Dockerode. | Revisit for production isolation |
| Keep `packages/shared` source-only | Consumers import DTOs directly from `src`; no build contract exists. | Pending |
| Treat the next milestone as production hardening | Core modules exist; the highest risk is reliability/security, not more feature breadth. | Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-27 after initialization*
