# Stack

*Last mapped: 2026-04-27*

## Languages
- **TypeScript 5.4+** — frontend, all services, shared DTOs, Drizzle schema, tooling.
- **SQL** — Drizzle-generated PostgreSQL migrations under `packages/db/src/migrations/`.
- **Shell** — `scripts/setup.sh`, `scripts/baseline-smoke.mjs` (Node), root pnpm scripts.

## Runtime
- **Node.js 20+** — required by root `package.json` `engines`.
- **pnpm 9** — declared in root `package.json` (`packageManager`) and `pnpm-workspace.yaml`.
- **Browser** — Next.js 16 / React 19 in `apps/web`.
- **Docker** — Dockerode-driven runtime/publish services + local infra via `infra/docker/docker-compose.yml`.
- **Lockfile**: `pnpm-lock.yaml`.

## Frameworks

### Frontend (`apps/web`)
- **Next.js 16.2.4** (App Router) — `apps/web/src/app/`.
- **React 19.2.4**.
- **Tailwind CSS v4** — `apps/web/src/app/globals.css`.
- **shadcn/Base UI primitives** — `apps/web/src/components/ui/`.
- **TanStack Query 5** — server state.
- **Zustand 5** — workspace/editor client state (`apps/web/src/store/workspace.ts`).
- **xterm.js** — browser terminal surface.
- **Monaco editor** — workspace file editing.
- **lucide-react** — icons.

### Backend (`services/*`)
- **Fastify 4.26.x** — every service.
- **fastify-type-provider-zod** — runtime-validated routes.
- **Zod** — DTOs and (where applied) env validation.
- **Pino** — logging via Fastify; `pino-pretty` in dev.
- **tsx watch** — dev runner.
- **tsc** — production build.
- **Vitest** — service tests (`auth`, `workspace`, `runtime`, `agent`, `memory`, `publish`).

### Data
- **PostgreSQL 16 + pgvector** (image `pgvector/pgvector:pg16`).
- **Drizzle ORM 0.45.x** — schema + migrations live in `packages/db/src/`.
- **Redis 7** + **BullMQ + ioredis** — automation queue (`services/agent/src/automation/queue.ts`).
- **MinIO** (S3-compatible) — file content + snapshots; AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/lib-storage`).
- **Traefik 3** — local reverse proxy + hosted-app routing.
- **Mailhog** — local SMTP capture.

### LLM / Agent
- **OpenAI SDK** — chat + embeddings.
- **Anthropic SDK** — Anthropic-compatible providers (incl. MiniMax).
- **Tool registry** — `services/agent/src/tools/registry.ts`.

## Key Dependencies
- `argon2` — password hashing (auth).
- `dockerode` — container control (runtime, publish).
- `postgres` — driver under Drizzle.
- `@pcp/db` — Drizzle client/schema/migrations/seed.
- `@pcp/shared` — Zod DTOs imported directly from `src/` (no build step).
- `@fastify/rate-limit` — rate limiting on every service.

## Configuration
- Service env reads `process.env`; `services/agent/src/env.ts` additionally loads `.env.local`, `.env`, and `infra/docker/.env`.
- Local infra reference: `infra/docker/.env.example`.
- DB config validated in `packages/db/src/client.ts` and `packages/db/drizzle.config.ts` (the canonical Zod-at-startup pattern).
- Root `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals/Parameters`, `isolatedModules`, ESNext + Bundler resolution, declaration output.
- Services build with `tsc`; web builds with `next build`.
- Root `pnpm typecheck` is currently a **no-op** (no package defines a `typecheck` script — AGENTS.md notes this; use `pnpm --filter <pkg> exec tsc --noEmit`).

## Platform Requirements
- Node.js 20+, pnpm 9+.
- Docker + Docker Compose (Postgres/Redis/MinIO/Traefik/Mailhog).
- `DATABASE_URL` required for all DB build/migration/runtime paths.
- Runtime + publish services need access to the Docker socket (or equivalent container runtime).
- Encryption: `ENCRYPTION_KEY` must be exactly 32 bytes (AES-256-GCM for stored API keys).
