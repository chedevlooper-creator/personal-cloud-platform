# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CloudMind OS — a multi-tenant, browser-based personal AI cloud computer. Next.js frontend backed by 6 independent Fastify microservices (auth, workspace, runtime, agent, memory, publish) with PostgreSQL, Redis, MinIO, and Docker-based sandboxing.

## Monorepo Layout

pnpm workspace (`pnpm@9`, Node 20+). Three roots: `apps/*`, `services/*`, `packages/*`.

- `apps/web` — Next.js 16 (App Router) + React 19 frontend
- `services/{auth,workspace,runtime,agent,memory,publish}` — independent Fastify v4 services, each on its own port (3001–3006)
- `packages/db` (`@pcp/db`) — Drizzle ORM schema (22 tables), migrations, seed. **Sole DB owner.**
- `packages/shared` (`@pcp/shared`) — Zod DTOs and types. **No build step** — imported directly from `src/`.

## Commands

```bash
pnpm dev                          # all services + web in parallel
pnpm build                        # tsc per service/package, next build for web
pnpm test                         # vitest run in services that define it
pnpm lint                         # only web + db (others lack lint scripts)
pnpm format                       # prettier

pnpm --filter @pcp/auth-service dev       # tsx watch src/index.ts
pnpm --filter @pcp/workspace-service test # vitest run
pnpm --filter @pcp/workspace-service exec vitest run src/service.test.ts  # single test file
pnpm --filter web dev                     # Next.js dev server

# Database (requires DATABASE_URL)
pnpm --filter @pcp/db generate    # create migration from schema
pnpm --filter @pcp/db migrate     # apply migrations (also: pnpm db:migrate)
pnpm --filter @pcp/db push        # dev-only schema push
pnpm --filter @pcp/db seed

# Infrastructure
pnpm infra:up                     # docker compose up -d (Postgres, Redis, MinIO, Traefik, Mailhog)
pnpm infra:down
pnpm infra:logs
```

`pnpm typecheck` is a **no-op** — no package defines it. Run per-package: `pnpm --filter <pkg> exec tsc --noEmit`.

## Architecture

**Layered service pattern:** `repository` (DB only) → `service` (business logic) → `route` (HTTP/WebSocket + Zod validation via `fastify-type-provider-zod`).

Each service entry (`services/*/src/index.ts`) creates a Fastify server, registers shared plugins (cors, rate-limit, cookie, websocket), a health route, and feature routes.

**Data stores:** PostgreSQL (source of truth + pgvector for memory), MinIO/S3 (file contents), Redis/BullMQ (automation jobs).

**Frontend:** TanStack Query for server state, Zustand for client state, Monaco editor for files, xterm.js for terminal, shadcn/ui + Tailwind v4 for UI.

## Critical Invariants

- **Tenant isolation:** Every DB query must filter by `user_id` or `organization_id`. S3 paths are tenant-prefixed. This is non-negotiable.
- **No cross-service DB access:** Services communicate via HTTP or BullMQ. Schema/migrations live only in `packages/db`.
- **`packages/shared` has no build step:** Never add `"build"` expectations or `dist/` references. All consumers import from `src/` directly.
- **Security:** Argon2id for passwords, AES-256-GCM for encrypted credentials, HTTP-only SameSite=Lax cookies, Zod validation on all inputs, helmet middleware, no secrets in code/logs.
- **Auth is duplicated across services** (cookie session validated via direct DB reads) — not centralized yet.

## Gotchas

- **Repo path contains spaces** — always quote paths in shell commands.
- **`README.md` has stale references** (mentions `apps/api` and port 4000). Ignore it; executable config and source code win.
- **Vitest versions diverge:** `auth` and `workspace` use `vitest@^4.1.5`; others use `^1.4.0`. Don't unify casually.
- **Next.js 16 + React 19 have breaking changes** vs older conventions. Check `apps/web/node_modules/next/dist/docs/` before routing/config work.
- **`pnpm lint` only runs in `apps/web` and `packages/db`.**
- **Several services use `process.env` fallbacks** with dummy defaults instead of Zod-validated env parsing. Prefer the pattern in `packages/db/src/client.ts`.
- **Some routes cast `as any`** to work around Fastify/Zod typing issues. Avoid adding new `any` unless the boundary is truly unknown.
- **`infra/docker/.env`** is gitignored. Copy from `.env.example` and never commit it.
- **Postgres image is pgvector** — required for the memory service embeddings.

## TypeScript Config

`tsconfig.base.json`: strict mode, `noUncheckedIndexedAccess` (array access yields `T | undefined`), `noUnusedLocals`, `noUnusedParameters`, `isolatedModules`, ES2022 target, Bundler module resolution. Frontend uses `@/` path alias for `apps/web/src`.

## Cursor Rules

`.cursor/rules/` contains `.mdc` files encoding project invariants: `architecture.mdc`, `backend-standards.mdc`, `database.mdc`, `security.mdc`, `testing.mdc`, `frontend.mdc`, `sandbox.mdc`, `agents.mdc`. Read the relevant rule before non-trivial work on a service — they encode invariants not visible from filenames.
