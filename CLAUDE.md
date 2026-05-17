# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CloudMind OS — a multi-tenant, browser-based "AI cloud computer". One Next.js
frontend (`apps/web`) plus **7 independent Fastify v4 microservices**
(`services/*`) on ports 3001–3007, two shared packages, and a Docker Compose
infra stack. **There is no `apps/api`** — the README's references to "API at
:4000", `apps/api`, and the `/health` curl block are stale; ignore them.

## Commands

pnpm 9 workspace, Node 20+. The repo path can contain spaces — quote paths in
shell commands.

```
pnpm install                       # frozen-lockfile in CI
pnpm dev                           # web + all 7 services in parallel (no auto-migrate)
pnpm typecheck                     # tsc --noEmit across all 10 packages
pnpm lint                          # ESLint where a lint script exists
pnpm test                          # vitest where defined (web uses Playwright; shared has none)
pnpm build                         # tsc per service/package, next build for web
pnpm format                        # Prettier: single quotes, semis, width 100, trailing commas
pnpm smoke:local                   # scripts/baseline-smoke.mjs → typecheck → lint → test → web smoke
pnpm smoke:web                     # Playwright top-3 frontend flows, mocked services
pnpm infra:up | infra:down | infra:logs
pnpm db:migrate | pnpm db:seed     # shorthands for @pcp/db
```

Per-package work uses pnpm filters (note the web package is named `web`, not
`@pcp/web`):

```
pnpm --filter @pcp/agent-service dev
pnpm --filter @pcp/workspace-service test
pnpm --filter @pcp/workspace-service exec vitest run src/service.test.ts   # single file
pnpm --filter web dev
```

DB workflow (drizzle-kit, requires `DATABASE_URL`; schema in
`packages/db/src/schema/*` → migrations in `packages/db/src/migrations/`):

```
pnpm --filter @pcp/db generate    # create migration from schema
pnpm --filter @pcp/db migrate
pnpm --filter @pcp/db push        # dev-only schema push
pnpm --filter @pcp/db studio
pnpm --filter @pcp/db seed        # idempotent: Sandbox workspace, skills, datasets, etc.
```

Local infra-backed bring-up: `cp infra/docker/.env.example infra/docker/.env`
→ `pnpm infra:up` → `pnpm --filter @pcp/db migrate`. Services expose `/health`
(liveness) and `/ready` (readiness).

## Architecture

Frontend talks to each service over HTTP with cookie sessions. Services are
**independent** and never reach into each other's data — they communicate via
HTTP, Redis pub-sub, and BullMQ.

| Service (`services/*`)      | Port | Responsibility |
|-----------------------------|------|----------------|
| `auth` (`@pcp/auth-service`)        | 3001 | Email/password + Google OAuth, sessions, admin, rate-limited login |
| `workspace` (`@pcp/workspace-service`) | 3002 | S3-backed file tree, workspace CRUD, snapshots, DuckDB datasets |
| `runtime` (`@pcp/runtime-service`)  | 3003 | Terminal PTY over WebSocket, Docker-based execution, security policy |
| `agent` (`@pcp/agent-service`)      | 3004 | LLM orchestration + tool calling, MCP clients, BullMQ automation worker |
| `memory` (`@pcp/memory-service`)    | 3005 | pgvector embeddings / semantic memory (Postgres image **must** be pgvector) |
| `publish` (`@pcp/publish-service`)  | 3006 | Static site / Node API deploys via Docker + Traefik |
| `browser` (`@pcp/browser-service`)  | 3007 | Cloud Playwright sessions, page extract tools |

Shared packages:

- **`packages/db` (`@pcp/db`)** — Drizzle ORM schema, migrations, seed. The
  **only** code with DB access. `src/client.ts` loads root `.env` via dotenv.
- **`packages/shared` (`@pcp/shared`)** — pure TS Zod DTOs, **no build step**.
  Consumers import from `src/` directly; never add a `"build"` expectation on
  it, and there is no `dist/`.

Infra (`infra/docker/docker-compose.yml`, env file `infra/docker/.env`):
Postgres (pgvector pg16), Redis 7, MinIO (S3), Traefik v3, Mailhog. The
`.env` is gitignored — never commit it. Docker/seccomp sandbox profiles for
runtime/publish are documented in `infra/docker/POLICY.md`.

### Inside a service

Layering is strict: **`repository` (DB only) → `service` (logic) → `route`
(HTTP + Zod validation)**. Request/response DTOs come from `@pcp/shared`.
`services/agent` is the richest example (`routes.ts` → `orchestrator.ts` plus
`llm/`, `mcp/`, `tools/`, `skills/`, `automation/queue.ts`).

## Conventions & constraints

- **Tenant isolation is mandatory**: every DB query filters by `user_id` or
  `organization_id`; S3/storage paths are tenant-prefixed.
- **Config via env, validated with Zod at startup** — see
  `services/agent/src/env.ts` and `packages/db/src/client.ts` for the pattern.
  `services/agent` auto-loads `.env.local`, `.env`, then `infra/docker/.env`;
  **most other services do not** — they rely on the process environment.
- **Logging**: pino JSON with `correlationId, userId, service`; no PII.
- **TypeScript** (`tsconfig.base.json`): `strict`, `noUncheckedIndexedAccess`
  (indexed access yields `T | undefined`), `noImplicitOverride`,
  `noUnused{Locals,Parameters}`, `isolatedModules`, ESNext + Bundler.
- **vitest is intentionally split**: `services/auth` and `services/workspace`
  pin `vitest@^4.1.5`; other services use `^1.4.0`. APIs differ — do **not**
  unify casually.
- Cross-component frontend events: `app:attach-file-to-chat`,
  `app:apply-code-to-workspace`.
- Required env: `DATABASE_URL`, `REDIS_URL`, `S3_ENDPOINT`/`S3_ACCESS_KEY`/
  `S3_SECRET_KEY`, `COOKIE_SECRET`, `ENCRYPTION_KEY` (exactly 32 bytes, AES-256-GCM
  for API-key encryption). `ADMIN_EMAIL` gates `/admin`. Google OAuth optional.

## CI

`.github/workflows/ci.yml` on push/PR to main/master:

1. **sandbox-regression** (only if runtime/publish/shared/POLICY changed):
   policy + service vitest suites for runtime, publish, and `@pcp/shared`.
2. **verify** (always): `pnpm install --frozen-lockfile` → `pnpm typecheck`
   → `pnpm lint` → `pnpm test`, in that order.

## Reference docs

`docs/PROGRESS.md` (status), `docs/PRODUCTION.md` (deploy),
`docs/DECISIONS.md` (ADR log), `docs/DATA_MODEL.md` (table-by-table schema),
`docs/AGENT.md` (agent loop, system prompt, tool catalog, BYOK), plus
per-service/per-package READMEs. `AGENTS.md` holds the same surgical notes for
other agents — keep the two in sync when conventions change.
