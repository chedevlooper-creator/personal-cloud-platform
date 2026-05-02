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
