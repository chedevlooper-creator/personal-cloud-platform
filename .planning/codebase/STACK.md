# Stack

> Source: package.json files, AGENTS.md, infra/docker/docker-compose.yml.
> Last updated: 2026-05-06

## Runtime

| Layer | Choice | Version | Rationale |
|---|---|---|---|
| Node | Node.js | ≥20 | Required by `engines.node` |
| Package manager | pnpm | 9.0.0 | Workspaces; `corepack pnpm` invoked from root scripts |
| Language | TypeScript | 5.4 | strict + `noUncheckedIndexedAccess`, `noImplicitOverride`, `isolatedModules`, ESNext + Bundler resolution |

## Frontend (`apps/web`)

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.4 (App Router) |
| UI | React 19 |
| Styling | Tailwind v4 |
| Components | shadcn/ui |
| Language | TypeScript |
| Testing | None (no `test` script in `apps/web`) |

UI text is Turkish.

## Backend Services (7× Fastify)

| Layer | Choice |
|---|---|
| HTTP framework | Fastify v4 |
| Validation | Zod (request schemas) |
| Logger | pino (JSON, correlationId/userId/service tags) |
| Testing | vitest |
| Dev runner | tsx watch |

**Vitest version drift (do not unify casually):**
- `services/auth`, `services/workspace`: `vitest@^4.1.5`
- Other services: `vitest@^1.4.0`
APIs differ — unifying breaks tests.

## Database & Persistence

| Layer | Choice |
|---|---|
| Database | PostgreSQL 16 with pgvector (`docker-compose` uses pgvector image) |
| ORM | Drizzle |
| Migrations | drizzle-kit (`generate` / `migrate` / `push` / `studio`) |
| Schema location | `packages/db/src/schema/*` (24 tables) |
| Migrations location | `packages/db/src/migrations/` |
| Seed | `packages/db/src/seed.ts` (idempotent: Sandbox workspace, skills, datasets, hosted services, automations) |

Postgres image **must** be pgvector — required by `services/memory`.

## Queue & Cache

| Layer | Choice |
|---|---|
| Queue | BullMQ (`services/agent` automations) |
| Broker / cache | Redis 7 |

## Storage & Networking

| Layer | Choice |
|---|---|
| Object storage | MinIO (S3-compatible) — workspace files, snapshots tar.gz |
| Reverse proxy | Traefik v3 — fronts `services/publish` hosted services |
| Mail (dev) | Mailhog |

## Container Runtime

| Layer | Choice |
|---|---|
| Container engine | Docker / Dockerode |
| Sandbox profile | `infra/docker/seccomp-runtime.json` (custom seccomp) |
| Hosted apps | Docker containers behind Traefik (`services/publish`) |
| Workspace runtime | Docker (`services/runtime`) with command policy: strict / balanced / permissive |

## Auth Stack

| Layer | Choice |
|---|---|
| Local auth | Email/password + Argon2 hashing |
| OAuth | Google |
| Session | Cookie-based |
| External JWT | Supabase JWT bridge (recently added — commits `04b46d8`, `ecee89c`) |
| Internal service auth | Internal service token + `X-User-Id` header |
| Encryption | AES-256-GCM, 32-byte `ENCRYPTION_KEY` env |

**Audit gap:** Internal token + arbitrary `X-User-Id` is broad impersonation; no audience/service scoping.

## Browser Automation

| Layer | Choice |
|---|---|
| Driver | Playwright (root `devDependencies`) |
| Service | `services/browser` (per-user cloud sessions, agent tools for navigate/extract) |

## AI / Agent

| Layer | Choice |
|---|---|
| Orchestration | `services/agent` (`AgentOrchestrator`) — 64 source files, 14 tests |
| LLM | BYOK (multi-provider, encrypted credentials) |
| Tool calls | Approval UI + `tool_calls` schema |
| MCP | `services/agent/src/mcp/` |
| Memory | pgvector embeddings via `services/memory` |
| Channels | Telegram bot adapter (webhook → agent) |
| Automations | BullMQ schedules (manual/hourly/daily/weekly/cron) |

## Tooling

| Layer | Choice |
|---|---|
| Formatter | Prettier (`.prettierrc`: single quotes, semis, width 100, trailing commas) |
| Linter | ESLint — only `apps/web` and `packages/db` define lint scripts |
| Smoke check | `scripts/baseline-smoke.mjs` (run via `pnpm smoke:local`) |
| CI | GitHub Actions — `pnpm install --frozen-lockfile` → typecheck → lint → test |

## What NOT to use

- **Cross-service DB access** — forbidden; services talk over HTTP / Redis pub-sub / BullMQ.
- **Per-process rate limiters in production** — `services/workspace`, `services/agent` use in-process limits; horizontal scaling weakens them. Use a distributed Redis-backed limiter when scaling out.
- **`@pcp/shared` as a buildable package** — it has no `dist/`, consumers import directly from `src/`. Don't add `"build"` expectations to it.
- **Codex/Gemini-only workflows** — pick one runtime per session; `services/agent/src/env.ts` loads `.env.local`/`.env`/`infra/docker/.env`, others don't.

## Confidence

High — all values cross-checked against `package.json`, `docker-compose.yml`, `tsconfig.base.json`, `AGENTS.md`. No web/training-data inference.
