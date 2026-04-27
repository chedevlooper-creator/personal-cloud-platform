# Technology Stack

**Analysis Date:** 2026-04-27

## Languages

**Primary:**
- TypeScript 5.x - Frontend, backend services, shared DTOs, Drizzle schema, and tooling.

**Secondary:**
- SQL - Drizzle-generated PostgreSQL migrations in `packages/db/src/migrations/`.
- Shell - Local setup and infrastructure scripts in `scripts/` and root package scripts.

## Runtime

**Environment:**
- Node.js 20+ - Required by root `package.json`.
- Browser runtime - Next.js/React application in `apps/web`.
- Docker runtime - Used by `services/runtime`, `services/publish`, and local infrastructure.

**Package Manager:**
- pnpm 9 - Declared in root `package.json` and `pnpm-workspace.yaml`.
- Lockfile: `pnpm-lock.yaml` is present.

## Frameworks

**Core:**
- Next.js 16.2.4 - App Router frontend in `apps/web`.
- React 19.2.4 - UI components and client state in `apps/web/src`.
- Fastify 4.26.x - Independent HTTP services under `services/*`.
- Drizzle ORM 0.45.x - Database schema and access in `packages/db`.

**UI:**
- Tailwind CSS 4 - Global styling in `apps/web/src/app/globals.css`.
- shadcn/Base UI primitives - UI components in `apps/web/src/components/ui`.
- lucide-react - Iconography.
- xterm.js - Browser terminal surface.
- Monaco editor - Workspace file editing.
- TanStack Query 5 - Server state in the frontend.
- Zustand 5 - Workspace client state in `apps/web/src/store/workspace.ts`.

**Backend Infrastructure:**
- PostgreSQL 16 with pgvector - Source of truth and vector memory.
- Redis 7 - Queue/cache substrate, currently used by BullMQ automations.
- MinIO - S3-compatible workspace file/object storage.
- Traefik 3 - Local reverse proxy and hosted app routing.
- Mailhog - Local SMTP testing.

**AI and Jobs:**
- OpenAI SDK - OpenAI chat and embeddings.
- Anthropic SDK - Anthropic-compatible chat providers, including MiniMax.
- BullMQ + ioredis - Automation queue in `services/agent/src/automation/queue.ts`.

**Testing:**
- Vitest - Service tests.
- ESLint - Present for `apps/web` and `packages/db`.
- TypeScript compiler - Build and ad hoc type checks.

## Key Dependencies

**Critical:**
- `fastify-type-provider-zod` - Runtime validation and typed Fastify schemas.
- `zod` - Shared DTOs and env validation.
- `postgres` - PostgreSQL driver used by Drizzle.
- `dockerode` - Runtime and publish service Docker control.
- `@aws-sdk/client-s3` and `@aws-sdk/lib-storage` - Workspace object storage.
- `argon2` - Password hashing in auth service.

**Workspace Packages:**
- `@pcp/db` - Drizzle client, schema, migrations, seed.
- `@pcp/shared` - Zod DTOs imported directly from `src/`; no build artifact required.

## Configuration

**Environment:**
- Root and service env vars are read from process env; `services/agent/src/env.ts` additionally loads `.env.local`, `.env`, and `infra/docker/.env`.
- Required local infra values are documented in `infra/docker/.env.example`.
- Database config is validated in `packages/db/src/client.ts` and `packages/db/drizzle.config.ts`.

**Build:**
- Root `tsconfig.base.json` enables strict TypeScript, `noUncheckedIndexedAccess`, `isolatedModules`, and declaration output.
- Services compile with `tsc`; web builds with `next build`.
- Root `pnpm typecheck` is currently a no-op because packages do not define `typecheck` scripts.

## Platform Requirements

**Development:**
- Node.js 20+.
- pnpm 9+.
- Docker and Docker Compose for Postgres, Redis, MinIO, Traefik, and Mailhog.
- `DATABASE_URL` is required for DB build/migration/runtime paths.

**Production:**
- Production guide expects Traefik in front of independent services, managed PostgreSQL/Redis/S3-compatible storage, and explicit secrets.
- Runtime/publish Docker control requires access to Docker socket or an equivalent container runtime boundary.

---
*Stack analysis: 2026-04-27*
*Update after major dependency or platform changes*
