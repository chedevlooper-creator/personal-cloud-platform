---
focus: tech
mapped_at: 2026-04-27
last_mapped_commit: c55e9b3bb8f13d990887889dfeb3418507c7a360
---

# Stack

## Summary

This repository is a pnpm 9 workspace for a browser-based personal cloud platform. It combines a Next.js 16 / React 19 frontend with independent Fastify services, shared Zod DTOs, and a Drizzle/PostgreSQL data package.

The stack is modern but uneven: the package layout is clear, while several services still use MVP-level direct database access, permissive defaults, `any`, simulated tools, or simplified Docker behavior.

## Package Layout

| Area | Package | Purpose |
|------|---------|---------|
| Frontend | `apps/web` | Next.js 16 App Router frontend with React 19, Tailwind v4, shadcn-style UI, TanStack Query, Zustand, Monaco, xterm |
| Auth | `services/auth` | Email/password auth, Google OAuth, sessions, profile preferences, provider credentials, admin endpoints |
| Workspace | `services/workspace` | Workspace CRUD, file metadata, S3/MinIO object storage, snapshots |
| Runtime | `services/runtime` | Docker-backed runtime containers and command execution |
| Agent | `services/agent` | Chat, task orchestration, tool calls, approval flow, automation queue |
| Memory | `services/memory` | pgvector-backed memory entries and OpenAI embeddings |
| Publish | `services/publish` | Docker/Traefik hosted services for static/Vite/Node apps |
| Database | `packages/db` | Drizzle schema, migrations, client, seed |
| Shared | `packages/shared` | Zod schemas and TypeScript DTOs imported directly from `src` |

## Languages And Runtime

- TypeScript across app, services, shared packages, and Drizzle schema.
- Node.js 20+ required by root `package.json`.
- pnpm workspace with packages under `apps/*`, `services/*`, and `packages/*`.
- Services run via `tsx watch src/index.ts` in development and `tsc` for builds.
- `packages/shared` has no build script and exposes `./src/index.ts` directly.

## Frontend Stack

- Next.js `16.2.4`, React `19.2.4`, React DOM `19.2.4` in `apps/web/package.json`.
- Tailwind v4 through `@tailwindcss/postcss`, plus `tw-animate-css`.
- UI dependencies include `@base-ui/react`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `sonner`, and shadcn CLI package.
- Data and state: `axios`, `@tanstack/react-query`, and `zustand`.
- Workspace UI: `@monaco-editor/react`, `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links`, and `react-resizable-panels`.
- API clients live in `apps/web/src/lib/api.ts` and point directly at service ports.

## Backend Stack

- Fastify v4 services with `fastify-type-provider-zod`.
- Common plugins: `@fastify/cookie`, `@fastify/cors`, `@fastify/rate-limit`.
- Service-specific plugins:
  - `services/auth`: `@fastify/oauth2`, `argon2`.
  - `services/workspace`: `@fastify/multipart`, AWS S3 SDK.
  - `services/runtime`: `@fastify/websocket`, `dockerode`.
  - `services/agent`: BullMQ, ioredis, OpenAI, Anthropic SDK.
  - `services/memory`: OpenAI embeddings.
  - `services/publish`: Dockerode and Traefik labels.
- Logging is Fastify/pino, with `pino-pretty` in development.

## Database And Infra

- `packages/db` uses Drizzle ORM and `postgres` for PostgreSQL access.
- Schema files live in `packages/db/src/schema/*.ts`.
- Migrations live in `packages/db/src/migrations/`.
- `infra/docker/docker-compose.yml` provides:
  - PostgreSQL 16 via `pgvector/pgvector:pg16`
  - Redis 7
  - MinIO
  - Traefik v3
  - Mailhog
- `infra/docker/postgres/init.sql` initializes database extensions.

## AI And Embeddings

- `services/agent/src/llm/provider.ts` supports `openai`, `anthropic`, and `minimax`.
- Minimax is implemented through the Anthropic-compatible provider path.
- Defaults are fallback dummy keys if env vars are missing, which is useful for bootstrapping but unsafe as a production pattern.
- `services/memory/src/embeddings/openai.ts` uses `text-embedding-3-small` at 1536 dimensions.

## Tooling

- Root scripts fan out with `pnpm -r`.
- `pnpm build` runs `tsc` for services/packages and `next build` for web.
- `pnpm test` runs packages that define `test`; web and shared do not.
- `pnpm lint` currently applies only where packages define `lint`.
- Root `pnpm typecheck` is declared but is a no-op unless packages add a `typecheck` script.
- Per-package typecheck should use `pnpm --filter <pkg> exec tsc --noEmit`.

## TypeScript Settings

- `tsconfig.base.json` enables strict checks, including `noUncheckedIndexedAccess`, `noImplicitOverride`, and `noUnusedLocals/Parameters`.
- Backend packages extend the base config, emit declarations and source maps, and build into `dist`.
- The web app has its own Next.js TypeScript config with `@/*` mapped to `apps/web/src/*`.

## Important Version Notes

- `services/auth` and `services/workspace` use Vitest `^4.1.5`.
- Other services use Vitest `^1.4.0`.
- Next.js is version 16, so routing/config changes should be checked against local Next docs in `apps/web/node_modules/next/dist/docs/`.

