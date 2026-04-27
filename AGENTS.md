# AGENTS.md

Repo-specific notes for OpenCode. Keep edits surgical; trust executable config over prose.

## Repo shape

pnpm workspace (`pnpm@9`, Node 20+). Packages live in `apps/*`, `services/*`, `packages/*`.

- `apps/web` — Next.js 16 + React 19 frontend. **No `apps/api` exists** (the README is stale). The backend is split across `services/*`, not a single gateway.
- `services/{auth,workspace,runtime,agent,memory,publish,browser}` — independent Fastify (v4) services using `fastify-type-provider-zod`, `tsx watch` for dev, `tsc` for build, `vitest` for tests.
- `packages/db` (`@pcp/db`) — Drizzle ORM schema, migrations, seed. Owns the only DB access.
- `packages/shared` (`@pcp/shared`) — pure TS, **no build step**; consumers import directly from `src/`.

Service contracts and tenant rules live in `.cursor/rules/*.mdc` (architecture, backend-standards, database, security, sandbox, testing, frontend, agents). Read the relevant rule before modifying a service — they encode invariants (tenant scoping, repo/service/route layering, pino fields, etc.) that aren't visible from filenames.

## Commands

Root scripts are `pnpm -r` fan-outs. Many are partial because not every package defines every script:

- `pnpm typecheck` — runs `tsc --noEmit` across every package (web, db, shared, and all 7 services). All packages now define a `typecheck` script.
- `pnpm lint` — only runs in packages with a `lint` script (currently `apps/web` and `packages/db`).
- `pnpm test` — runs `vitest run` in services that define it. `apps/web` and `packages/shared` have no tests.
- `pnpm build` — `tsc` per service/package; `next build` for web.
- `pnpm format` — Prettier (`.prettierrc`: single quotes, semis, width 100, trailing commas).

Per-package work uses pnpm filters:

```
pnpm --filter @pcp/auth-service dev          # tsx watch
pnpm --filter @pcp/workspace-service test    # vitest run
pnpm --filter @pcp/workspace-service exec vitest run src/service.test.ts   # single file
pnpm --filter web dev                        # Next.js (note: name is "web", not "@pcp/web")
```

DB workflow (drizzle-kit, requires `DATABASE_URL` env):

```
pnpm --filter @pcp/db generate    # create migration from schema/*
pnpm --filter @pcp/db migrate     # apply (also: pnpm db:migrate)
pnpm --filter @pcp/db push        # dev-only schema push
pnpm --filter @pcp/db studio
pnpm --filter @pcp/db seed
```

Schema files: `packages/db/src/schema/*` → migrations emitted to `packages/db/src/migrations/`.

## Infra

`pnpm infra:up | infra:down | infra:logs` wraps `infra/docker/docker-compose.yml`. Stack: Postgres (pgvector pg16), Redis 7, MinIO, Traefik, Mailhog. Required env file: `infra/docker/.env` (copy from `.env.example`). Postgres image is **pgvector** — required for the memory service.

## TypeScript

`tsconfig.base.json` enables `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals/Parameters`, `isolatedModules`, ESNext + Bundler resolution. Code must satisfy `noUncheckedIndexedAccess` (array/index access yields `T | undefined`).

## Frontend (apps/web)

`apps/web/AGENTS.md` flag: this is **Next.js 16 + React 19**, with breaking changes vs. older training data. Consult `apps/web/node_modules/next/dist/docs/` before changing routing, server components, or config. Tailwind v4 + shadcn are used.

## Conventions worth preserving

From `.cursor/rules/architecture.mdc` (load with the relevant module rule before non-trivial work):

- No cross-service DB access — services talk over HTTP / Redis pub/sub / BullMQ.
- Every query must filter by `user_id` or `organization_id`. Storage paths are tenant-prefixed.
- Layering inside a service: `repository` (DB only) → `service` (logic) → `route` (HTTP + Zod validation). DTOs live in `@pcp/shared`.
- Logging is pino JSON with `correlationId, userId, service`; no PII.
- Config via env, validated with Zod at startup (see `packages/db/drizzle.config.ts` for the pattern).

## Gotchas

- The repo path contains spaces — quote paths in shell commands.
- `services/auth` and `services/workspace` pin `vitest@^4.1.5`; other services are on `^1.4.0`. Don't unify casually — APIs differ.
- README's "API at :4000" and "apps/api" references are stale; ignore them.
- `packages/shared` has no `dist/` — never add `"build"` expectations on it from other packages; they import from `src` directly.
- `.gitignore` excludes `infra/docker/.env`; never commit it.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**CloudMind OS - Personal AI Cloud Computer**

CloudMind OS is a multi-tenant, browser-based personal AI cloud computer. Users get persistent workspaces, file management, an AI agent with tool calling, browser terminal access, automation scheduling, app hosting, snapshots, settings, and admin surfaces through a Next.js frontend backed by independent Fastify services.

This is a brownfield TypeScript pnpm monorepo: the major product modules already exist, but the implementation still needs production-readiness work around security hardening, tenant isolation, runtime sandboxing, agent durability, test coverage, and deployment reliability.

**Core Value:** Users can safely run and automate useful work inside persistent cloud workspaces without leaking tenant data, credentials, or host resources.

### Constraints

- **Runtime**: Node.js 20+ and pnpm 9+ are required by root package metadata.
- **Database**: PostgreSQL with pgvector is required; memory service depends on vector support.
- **Architecture**: No cross-service DB ownership changes; schema and migrations stay in `packages/db`.
- **Frontend**: Next.js 16 and React 19 differ from older conventions; check `apps/web/node_modules/next/dist/docs/` before routing/config work.
- **Security**: Every resource query and storage path must be tenant scoped by user/workspace/organization context.
- **Sandbox**: Docker is the MVP runtime boundary; production-readiness work must reduce host escape and resource exhaustion risk before enabling untrusted execution broadly.
- **Docs**: `README.md` has stale areas; executable config and source code win over prose.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.x - Frontend, backend services, shared DTOs, Drizzle schema, and tooling.
- SQL - Drizzle-generated PostgreSQL migrations in `packages/db/src/migrations/`.
- Shell - Local setup and infrastructure scripts in `scripts/` and root package scripts.
## Runtime
- Node.js 20+ - Required by root `package.json`.
- Browser runtime - Next.js/React application in `apps/web`.
- Docker runtime - Used by `services/runtime`, `services/publish`, and local infrastructure.
- pnpm 9 - Declared in root `package.json` and `pnpm-workspace.yaml`.
- Lockfile: `pnpm-lock.yaml` is present.
## Frameworks
- Next.js 16.2.4 - App Router frontend in `apps/web`.
- React 19.2.4 - UI components and client state in `apps/web/src`.
- Fastify 4.26.x - Independent HTTP services under `services/*`.
- Drizzle ORM 0.45.x - Database schema and access in `packages/db`.
- Tailwind CSS 4 - Global styling in `apps/web/src/app/globals.css`.
- shadcn/Base UI primitives - UI components in `apps/web/src/components/ui`.
- lucide-react - Iconography.
- xterm.js - Browser terminal surface.
- Monaco editor - Workspace file editing.
- TanStack Query 5 - Server state in the frontend.
- Zustand 5 - Workspace client state in `apps/web/src/store/workspace.ts`.
- PostgreSQL 16 with pgvector - Source of truth and vector memory.
- Redis 7 - Queue/cache substrate, currently used by BullMQ automations.
- MinIO - S3-compatible workspace file/object storage.
- Traefik 3 - Local reverse proxy and hosted app routing.
- Mailhog - Local SMTP testing.
- OpenAI SDK - OpenAI chat and embeddings.
- Anthropic SDK - Anthropic-compatible chat providers, including MiniMax.
- BullMQ + ioredis - Automation queue in `services/agent/src/automation/queue.ts`.
- Vitest - Service tests.
- ESLint - Present for `apps/web` and `packages/db`.
- TypeScript compiler - Build and ad hoc type checks.
## Key Dependencies
- `fastify-type-provider-zod` - Runtime validation and typed Fastify schemas.
- `zod` - Shared DTOs and env validation.
- `postgres` - PostgreSQL driver used by Drizzle.
- `dockerode` - Runtime and publish service Docker control.
- `@aws-sdk/client-s3` and `@aws-sdk/lib-storage` - Workspace object storage.
- `argon2` - Password hashing in auth service.
- `@pcp/db` - Drizzle client, schema, migrations, seed.
- `@pcp/shared` - Zod DTOs imported directly from `src/`; no build artifact required.
## Configuration
- Root and service env vars are read from process env; `services/agent/src/env.ts` additionally loads `.env.local`, `.env`, and `infra/docker/.env`.
- Required local infra values are documented in `infra/docker/.env.example`.
- Database config is validated in `packages/db/src/client.ts` and `packages/db/drizzle.config.ts`.
- Root `tsconfig.base.json` enables strict TypeScript, `noUncheckedIndexedAccess`, `isolatedModules`, and declaration output.
- Services compile with `tsc`; web builds with `next build`.
- Root `pnpm typecheck` is currently a no-op because packages do not define `typecheck` scripts.
## Platform Requirements
- Node.js 20+.
- pnpm 9+.
- Docker and Docker Compose for Postgres, Redis, MinIO, Traefik, and Mailhog.
- `DATABASE_URL` is required for DB build/migration/runtime paths.
- Production guide expects Traefik in front of independent services, managed PostgreSQL/Redis/S3-compatible storage, and explicit secrets.
- Runtime/publish Docker control requires access to Docker socket or an equivalent container runtime boundary.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Service entry files use `index.ts`.
- Service route files use `routes.ts`; larger surfaces use `routes/<feature>.ts`.
- Service logic commonly uses `service.ts`.
- Frontend component filenames are kebab-case, e.g. `app-shell.tsx`, `tool-approval-card.tsx`.
- Test files use `*.test.ts` and some `src/__tests__/*.test.ts`.
- camelCase for functions, local variables, and object fields.
- Classes use PascalCase, e.g. `AuthService`, `RuntimeService`, `AgentOrchestrator`.
- Schema constants use camelCase with `Schema` suffix, e.g. `createTaskSchema`.
- DTO types are exported from Zod with PascalCase names, e.g. `RegisterDto`.
- Interfaces are PascalCase, e.g. `WorkspaceState`, `UseTerminalOptions`.
## Code Style
- Prettier config: single quotes, semicolons, print width 100, trailing commas.
- TypeScript strictness is high via `tsconfig.base.json`.
- `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, and `isolatedModules` are enabled.
- Root `pnpm lint` fans out to packages with a lint script.
- Current lint scripts exist in `apps/web` and `packages/db`.
## Import Organization
- Frontend uses `@/` for `apps/web/src`.
- Backend imports workspace packages through `@pcp/db` and `@pcp/shared`.
- Services currently import DB internals directly from `@pcp/db/src/...`.
## Validation
- Fastify routes use `fastify-type-provider-zod`.
- DTOs should live in `packages/shared/src/` when consumed across services/frontend.
- Prefer Zod-validated env parsing at startup.
- `packages/db/src/client.ts` shows the target pattern.
- Several services still rely on raw `process.env` fallback values; this should be tightened.
## Error Handling
- Service methods throw `Error` for failures.
- Routes often send ad hoc `{ error: string }` responses.
- Workspace has a `WorkspaceError` class for status-aware errors.
- Use custom error classes.
- Do not leak internal errors to clients.
- Log with correlation/user/service context.
- Return consistent response shapes.
## Logging
- Pino via Fastify logger.
- Development can use `pino-pretty`.
- Some services log operational events, e.g. auth attempts, automation run processing.
- Some code paths use `console.error`, especially provider/service catch handlers.
- Use `fastify.log` or injected service logger.
- Avoid PII and secrets in log payloads.
- Include `correlationId`, `userId`, and `service` where available.
## Database Access
- Services import Drizzle client and schema directly from `@pcp/db/src`.
- Queries should be scoped by `userId` or `organizationId`.
- Soft-delete tables use `deletedAt`/`deleted_at` where relevant.
- Repository layer owns DB access.
- Service layer owns business logic.
- Route layer owns HTTP and Zod validation.
## Comments
- Comments are common around security, temporary implementations, and TODO-like MVP shortcuts.
- Some comments identify simulated or incomplete behavior in agent and automation flows.
- Explain why and risk, not obvious mechanics.
- Avoid commented-out code.
- Add ticket/context for TODOs when they survive beyond local work.
## Function and Module Design
- Service classes are large and own both domain logic and provider/database access.
- Routes create service instances directly.
- Several DTOs use `z.any()` or route casts to `as any` to work around Fastify/Zod typing.
- Keep route handlers thin.
- Add focused repositories/helpers when logic grows.
- Avoid adding new `any` unless the boundary truly is unknown and immediately narrowed.
- Preserve tenant checks in every DB operation.
## Frontend Conventions
- App shell wraps authenticated pages through `apps/web/src/app/(main)/layout.tsx`.
- Shared UI primitives live in `apps/web/src/components/ui`.
- Feature components live under `apps/web/src/components/<feature>`.
- TanStack Query for API data.
- Zustand for current workspace/editor state.
- Client components are used for interactive app surfaces.
- Tailwind v4 theme tokens in `apps/web/src/app/globals.css`.
- shadcn-compatible UI primitives.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- `apps/web` owns the browser UI and calls service APIs directly.
- `services/*` are independent Fastify services with separate ports and build/test scripts.
- `packages/db` owns the only Drizzle schema, migrations, and DB client.
- `packages/shared` owns Zod DTOs and is imported directly from `src`.
- Local infrastructure is Docker Compose-based.
## Layers
- Purpose: User-facing cloud workspace UI.
- Contains: App Router pages, app shell, workspace UI, API clients, client state.
- Location: `apps/web/src`.
- Depends on: public service URLs, shared UI libraries, TanStack Query, Zustand.
- Used by: browser users.
- Purpose: HTTP/WebSocket entry points with Zod validation.
- Contains: route registration files such as `services/auth/src/routes.ts`, `services/workspace/src/routes.ts`, `services/runtime/src/routes.ts`.
- Depends on: service classes and schemas from `@pcp/shared`.
- Used by: web app and other service clients.
- Purpose: Business behavior and orchestration.
- Contains: classes such as `AuthService`, `WorkspaceService`, `RuntimeService`, `AgentOrchestrator`, `MemoryService`, `PublishService`.
- Depends on: `@pcp/db/src/client`, Drizzle schema, external providers, Docker/S3/LLM SDKs.
- Used by: route layer.
- Purpose: Schema, migrations, and database connection.
- Contains: `packages/db/src/schema/*`, `packages/db/src/client.ts`, migrations.
- Depends on: Drizzle ORM and `postgres`.
- Used by: all services.
- Purpose: Request/response schemas and DTO types.
- Contains: `packages/shared/src/*.ts`.
- Depends on: Zod.
- Used by: services and frontend-adjacent code.
- Purpose: Local Postgres/Redis/MinIO/Traefik/Mailhog.
- Contains: `infra/docker/docker-compose.yml`, `infra/docker/postgres/init.sql`.
- Used by: local development and deployment reference.
## Data Flow
## State Management
- PostgreSQL stores users, sessions, workspaces, file metadata, runtimes, agent tasks, memory, hosting, settings, snapshots, integrations, and notifications.
- MinIO/S3 stores file contents and snapshot artifacts.
- Redis/BullMQ stores automation jobs.
- Zustand stores current workspace/editor state.
- TanStack Query manages async frontend server state.
## Key Abstractions
- Pattern: `index.ts` creates server, registers shared plugins, health route, and feature routes.
- Examples: `services/auth/src/index.ts`, `services/workspace/src/index.ts`.
- Pattern: class encapsulates business logic and DB/provider access.
- Examples: `AuthService`, `WorkspaceService`, `RuntimeService`, `MemoryService`, `PublishService`.
- Purpose: Abstract runtime backend so Docker can be replaced later.
- Examples: `services/runtime/src/provider/types.ts`, `services/runtime/src/provider/docker.ts`.
- Purpose: Abstract chat provider implementations.
- Examples: `services/agent/src/llm/types.ts`, `services/agent/src/llm/provider.ts`.
- Purpose: Register and dispatch agent tools.
- Examples: `services/agent/src/tools/registry.ts`, `read_file.ts`, `write_file.ts`, `run_command.ts`.
## Entry Points
- `apps/web/src/app/layout.tsx` - Root layout.
- `apps/web/src/app/(main)/layout.tsx` - Authenticated app shell.
- `apps/web/src/proxy.ts` - Next proxy/middleware surface.
- `services/auth/src/index.ts` - Port 3001.
- `services/workspace/src/index.ts` - Port 3002.
- `services/runtime/src/index.ts` - Port 3003.
- `services/agent/src/index.ts` - Port 3004.
- `services/memory/src/index.ts` - Memory service.
- `services/publish/src/index.ts` - Port 3006.
- `packages/db/drizzle.config.ts` - Drizzle Kit config.
- `packages/db/src/client.ts` - Drizzle runtime client.
- `packages/db/src/schema/index.ts` - Schema barrel.
## Error Handling
- Current implementation mostly throws standard `Error` instances from service classes and sends ad hoc `{ error }` responses from routes.
- `WorkspaceService` has a `WorkspaceError` pattern for status-aware file errors.
- Route handlers often short-circuit with `reply.code(401).send({ error: 'Unauthorized' } as any)`.
- Service logic logs some provider failures but not consistently.
- Repo rules call for custom error classes, consistent response envelopes, correlation IDs, and no internal error leakage; this is not yet fully implemented.
## Cross-Cutting Concerns
- Cookie session validation is duplicated across services using direct DB reads.
- Service methods generally accept `userId` and resource IDs, but coverage is uneven and should be audited before production.
- Zod validates route inputs through `fastify-type-provider-zod`.
- Some route params still use casts such as `as any`.
- Pino is configured per service.
- Required pino fields from repo rules are not consistently attached.
- Mixed: some startup paths validate env with Zod, while several services use fallback dummy/default secrets.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
