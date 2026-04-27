# AGENTS.md

Repo-specific notes for OpenCode. Keep edits surgical; trust executable config over prose.

## Repo shape

pnpm workspace (`pnpm@9`, Node 20+). Packages live in `apps/*`, `services/*`, `packages/*`.

- `apps/web` — Next.js 16 + React 19 frontend. **No `apps/api` exists** (the README is stale). The backend is split across `services/*`, not a single gateway.
- `services/{auth,workspace,runtime,agent,memory,publish}` — independent Fastify (v4) services using `fastify-type-provider-zod`, `tsx watch` for dev, `tsc` for build, `vitest` for tests.
- `packages/db` (`@pcp/db`) — Drizzle ORM schema, migrations, seed. Owns the only DB access.
- `packages/shared` (`@pcp/shared`) — pure TS, **no build step**; consumers import directly from `src/`.

Service contracts and tenant rules live in `.cursor/rules/*.mdc` (architecture, backend-standards, database, security, sandbox, testing, frontend, agents). Read the relevant rule before modifying a service — they encode invariants (tenant scoping, repo/service/route layering, pino fields, etc.) that aren't visible from filenames.

## Commands

Root scripts are `pnpm -r` fan-outs. Many are partial because not every package defines every script:

- `pnpm typecheck` — **no-op**: no package defines a `typecheck` script. To typecheck, run `pnpm --filter <pkg> exec tsc --noEmit`.
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
