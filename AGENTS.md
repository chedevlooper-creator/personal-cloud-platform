# AGENTS.md

Repo-specific notes for OpenCode. Keep edits surgical; trust executable config over prose.

## Repo shape

pnpm workspace (`pnpm@9`, Node 20+). Packages live in `apps/*`, `services/*`, `packages/*`.

- `apps/web` — Next.js 16.2.4 + React 19 frontend. **No `apps/api` exists** (README is stale). The backend is split across `services/*`.
- `services/{auth,workspace,runtime,agent,memory,publish,browser}` — independent Fastify v4 services on ports 3001–3007.
- `packages/db` (`@pcp/db`) — Drizzle ORM schema, migrations, seed. Owns the only DB access.
- `packages/shared` (`@pcp/shared`) — pure TS, **no build step**; consumers import directly from `src/`.

## Commands

Root scripts are `pnpm -r` fan-outs. Many are partial because not every package defines every script:

- `pnpm dev` — starts web + all 7 services in parallel.
- `pnpm typecheck` — `tsc --noEmit` across all 10 packages. All define a `typecheck` script.
- `pnpm lint` — only runs in packages with a `lint` script (`apps/web`, `packages/db`).
- `pnpm test` — `vitest run` in services that define it. `apps/web` and `packages/shared` have no tests.
- `pnpm build` — `tsc` per service/package; `next build` for web.
- `pnpm format` — Prettier (`.prettierrc`: single quotes, semis, width 100, trailing commas).
- `pnpm smoke:local` — baseline smoke check.
- `pnpm db:migrate` / `pnpm db:seed` — shorthands for `@pcp/db`.

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
pnpm --filter @pcp/db migrate     # apply
pnpm --filter @pcp/db push        # dev-only schema push
pnpm --filter @pcp/db studio
pnpm --filter @pcp/db seed
```

Schema files: `packages/db/src/schema/*` → migrations emitted to `packages/db/src/migrations/`.

## Infra

`pnpm infra:up | infra:down | infra:logs` wraps `infra/docker/docker-compose.yml`. Stack: Postgres (pgvector pg16), Redis 7, MinIO, Traefik 3, Mailhog. Required env file: `infra/docker/.env` (copy from `.env.example`). Postgres image is **pgvector** — required for the memory service.

## TypeScript

`tsconfig.base.json` enables `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals/Parameters`, `isolatedModules`, ESNext + Bundler resolution. Code must satisfy `noUncheckedIndexedAccess` (array/index access yields `T | undefined`).

## Frontend (apps/web)

Next.js 16 + React 19, App Router, Tailwind v4, shadcn/ui. Turkish UI text is used throughout (e.g. "Sohbet", "Chat'e ekle"). Consult `apps/web/node_modules/next/dist/docs/` before changing routing, server components, or config.

## Conventions

- No cross-service DB access — services talk over HTTP / Redis pub-sub / BullMQ.
- Every query must filter by `user_id` or `organization_id`. Storage paths are tenant-prefixed.
- Layering inside a service: `repository` (DB only) → `service` (logic) → `route` (HTTP + Zod validation). DTOs live in `@pcp/shared`.
- Logging is pino JSON with `correlationId, userId, service`; no PII.
- Config via env, validated with Zod at startup (see `packages/db/src/client.ts` and `services/agent/src/env.ts` for patterns).
- Custom events for cross-component communication: `app:attach-file-to-chat`, `app:apply-code-to-workspace`.

## Gotchas

- The repo path contains spaces — quote paths in shell commands.
- `services/auth` and `services/workspace` pin `vitest@^4.1.5`; other services are on `^1.4.0`. Don't unify casually — APIs differ.
- README's "API at :4000", "apps/api", and `/health` curl examples are stale; ignore them.
- `packages/shared` has no `dist/` — never add `"build"` expectations on it from other packages; they import from `src` directly.
- `.gitignore` excludes `infra/docker/.env`; never commit it.
- `services/agent/src/env.ts` loads `.env.local`, `.env`, and `infra/docker/.env` automatically; most other services do not.
- `packages/db/src/client.ts` loads `.env` from workspace root via `dotenv`.
- CI runs `pnpm install --frozen-lockfile`, then `typecheck` → `lint` → `test` in that order.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**CloudMind OS - Personal AI Cloud Computer**

Multi-tenant, browser-based personal AI cloud computer. Users get persistent workspaces, file management, an AI agent with tool calling, browser terminal access, automation scheduling, app hosting, snapshots, settings, and admin surfaces through a Next.js frontend backed by independent Fastify services.

Brownfield TypeScript pnpm monorepo needing production-readiness work around security hardening, tenant isolation, runtime sandboxing, agent durability, test coverage, and deployment reliability.

**Core Value:** Users can safely run and automate useful work inside persistent cloud workspaces without leaking tenant data, credentials, or host resources.

### Constraints

- **Runtime:** Node.js 20+ and pnpm 9+.
- **Database:** PostgreSQL with pgvector; memory service depends on vector support.
- **Architecture:** No cross-service DB ownership changes; schema and migrations stay in `packages/db`.
- **Frontend:** Next.js 16 and React 19 differ from older conventions; check `apps/web/node_modules/next/dist/docs/` before routing/config work.
- **Security:** Every resource query and storage path must be tenant scoped by user/workspace/organization context.
- **Sandbox:** Docker is the MVP runtime boundary.
- **Docs:** `README.md` has stale areas; executable config and source code win over prose.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

- **Languages:** TypeScript 5.x, SQL (Drizzle migrations), Shell (scripts).
- **Frontend:** Next.js 16.2.4, React 19.2.4, Tailwind CSS 4, shadcn/Base UI, TanStack Query 5, Zustand 5, xterm.js, Monaco editor.
- **Backend:** Fastify 4.26.x, `fastify-type-provider-zod`, Drizzle ORM 0.45.x, `postgres` driver.
- **Infra:** PostgreSQL 16 (pgvector), Redis 7, MinIO, Traefik 3, Mailhog.
- **AI/Queue:** OpenAI SDK, Anthropic SDK, BullMQ + ioredis.
- **Testing:** Vitest (auth/workspace pin `^4.1.5`, others `^1.4.0`), ESLint in web and db only.
- **Build:** `tsc` per service/package; `next build` for web. `packages/shared` has no build step.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

- Service entry files use `index.ts`; route files use `routes.ts` (or `routes/<feature>.ts`); logic uses `service.ts`.
- Frontend components are kebab-case. Test files: `*.test.ts`.
- camelCase for functions/variables; PascalCase for classes and DTOs; `Schema` suffix for Zod schemas.
- Frontend uses `@/` for `apps/web/src`. Backend imports workspace packages through `@pcp/db` and `@pcp/shared`.
- Fastify routes use `fastify-type-provider-zod`. DTOs should live in `packages/shared/src/` when consumed across services/frontend.
- Prefer Zod-validated env parsing at startup. `packages/db/src/client.ts` shows the target pattern.
- Service methods throw `Error` for failures. Use custom error classes. Do not leak internal errors to clients.
- Log with `fastify.log` or injected service logger. Include `correlationId`, `userId`, and `service`. Avoid PII.
- Repository layer owns DB access; service layer owns business logic; route layer owns HTTP and Zod validation.
- Preserve tenant checks in every DB operation.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

- `apps/web` owns the browser UI and calls service APIs directly.
- `services/*` are independent Fastify services with separate ports and build/test scripts.
- `packages/db` owns the only Drizzle schema, migrations, and DB client.
- `packages/shared` owns Zod DTOs and is imported directly from `src`.
- Local infrastructure is Docker Compose-based.

### Layers

1. **Frontend** (`apps/web/src`): App Router pages, app shell, workspace UI, API clients, client state.
2. **Routes** (`services/*/src/routes.ts`): HTTP/WebSocket entry points with Zod validation.
3. **Services** (`services/*/src/service.ts`): Business behavior and orchestration.
4. **Database** (`packages/db`): Schema, migrations, and DB connection.
5. **Shared DTOs** (`packages/shared/src/`): Request/response schemas.

### State Management

- PostgreSQL: users, sessions, workspaces, file metadata, runtimes, agent tasks, memory, hosting, settings, snapshots, integrations, notifications.
- MinIO/S3: file contents and snapshot artifacts.
- Redis/BullMQ: automation jobs.
- Zustand: current workspace/editor state.
- TanStack Query: async frontend server state.

### Entry Points

- `apps/web/src/app/layout.tsx` — Root layout.
- `apps/web/src/app/(main)/layout.tsx` — Authenticated app shell.
- `services/auth/src/index.ts` — Port 3001.
- `services/workspace/src/index.ts` — Port 3002.
- `services/runtime/src/index.ts` — Port 3003.
- `services/agent/src/index.ts` — Port 3004.
- `services/memory/src/index.ts` — Port 3005.
- `services/publish/src/index.ts` — Port 3006.
- `services/browser/src/index.ts` — Port 3007.
- `packages/db/drizzle.config.ts` — Drizzle Kit config.
- `packages/db/src/client.ts` — Drizzle runtime client.
- `packages/db/src/schema/index.ts` — Schema barrel.
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
