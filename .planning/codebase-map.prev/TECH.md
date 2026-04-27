# TECH

**Snapshot:** 2026-04-27
**Scope:** Personal Cloud Platform monorepo (`pnpm` workspace, 3 apps + 6 services + 2 packages).

This document is generated from a fresh read of every `package.json`, `tsconfig*.json`, the Drizzle config, the docker-compose stack, and a sweep of actual `import` statements in `src/`. Nothing here is inferred from the README — see "Drift & gotchas" below.

---

## Languages

| Language                | Versions                                                                     | Where                                                                |
| ----------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| TypeScript              | `^5.4.0` (root), `^5.4.2` (every service + `packages/db`), `^5` (`apps/web`) | All packages                                                         |
| JavaScript (ESM `.mjs`) | n/a                                                                          | `apps/web/eslint.config.mjs`, `apps/web/postcss.config.mjs`          |
| SQL                     | n/a                                                                          | `packages/db/src/migrations/*.sql`, `infra/docker/postgres/init.sql` |

No Python / Go / Rust. There is one stray `extract.js` at the repo root and an empty file `DDSD` — both ignorable.

### TypeScript config inheritance

Root `tsconfig.base.json` ([file](../../tsconfig.base.json)) sets the strict bar everything inherits:

- `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`
- `strict: true`, **`noUncheckedIndexedAccess: true`**, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- `isolatedModules`, `incremental`, `declaration` + `declarationMap`, `sourceMap`

Inheritance map:

| Package              | Extends base?            | Overrides                                                                                                              |
| -------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `services/auth`      | yes                      | `outDir: dist`, `rootDir: src`                                                                                         |
| `services/workspace` | yes                      | same                                                                                                                   |
| `services/runtime`   | yes                      | same                                                                                                                   |
| `services/agent`     | yes                      | same                                                                                                                   |
| `services/memory`    | yes                      | same                                                                                                                   |
| `services/publish`   | yes                      | same                                                                                                                   |
| `packages/db`        | yes                      | **overrides to `module: CommonJS`, `moduleResolution: Node`** (drift from base ESNext/Bundler — drizzle-kit needs CJS) |
| `packages/shared`    | yes                      | `outDir: dist`, `rootDir: src` (but never built — see Workspaces)                                                      |
| `apps/web`           | **no** (Next.js owns it) | `target: ES2017`, `jsx: react-jsx`, `noEmit: true`, path alias `@/* → ./src/*`, plugin `next`                          |

`apps/web` is the only TS project that does **not** inherit `tsconfig.base.json`. It picks its own settings via `create-next-app` defaults; `noUncheckedIndexedAccess` is **off** there.

---

## Package manager

|            | Value                                            | Source                                        |
| ---------- | ------------------------------------------------ | --------------------------------------------- |
| Manager    | pnpm                                             | `package.json` `packageManager: "pnpm@9.0.0"` |
| Engine pin | `pnpm >=9.0.0`, `node >=20.0.0`                  | root `engines`                                |
| Lockfile   | `pnpm-lock.yaml` (372 KB, present and committed) | repo root                                     |
| `.nvmrc`   | absent                                           | —                                             |

Root scripts ([package.json](../../package.json)) are all `pnpm -r` fan-outs:

| Script                 | Behavior                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `dev`                  | `pnpm -r --parallel dev` — every package with a `dev` script (services + web + db tsc-watch)                             |
| `build`                | `pnpm -r build` — only packages with a `build` script                                                                    |
| `lint`                 | `pnpm -r lint` — only `apps/web` and `packages/db` declare it (and `packages/db` has **no eslint config** — see Tooling) |
| `test`                 | `pnpm -r test` — six services declare `vitest run`; `apps/web` and `packages/shared` have none                           |
| `typecheck`            | **no-op** — no package defines a `typecheck` script. Use `pnpm --filter <pkg> exec tsc --noEmit`                         |
| `format`               | Prettier on `**/*.{ts,tsx,md,json}`                                                                                      |
| `infra:up/down/logs`   | `docker compose` in `infra/docker`                                                                                       |
| `db:migrate / db:seed` | filtered to `@pcp/db`                                                                                                    |

---

## Workspaces

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'packages/*'
  - 'services/*'
  - 'apps/*'
```

| Package              | Name                         | Kind             | Build step                        |
| -------------------- | ---------------------------- | ---------------- | --------------------------------- |
| `apps/web`           | `web` (note: not `@pcp/web`) | Next.js app      | `next build`                      |
| `services/auth`      | `@pcp/auth-service`          | Fastify svc      | `tsc`                             |
| `services/workspace` | `@pcp/workspace-service`     | Fastify svc      | `tsc`                             |
| `services/runtime`   | `@pcp/runtime-service`       | Fastify svc      | `tsc`                             |
| `services/agent`     | `@pcp/agent-service`         | Fastify svc      | `tsc`                             |
| `services/memory`    | `@pcp/memory-service`        | Fastify svc      | `tsc`                             |
| `services/publish`   | `@pcp/publish-service`       | Fastify svc      | `tsc`                             |
| `packages/db`        | `@pcp/db`                    | TS lib (Drizzle) | `tsc` (CJS)                       |
| `packages/shared`    | `@pcp/shared`                | TS lib (DTOs)    | **none** — `main: ./src/index.ts` |

`@pcp/shared` has **no build step and no dist/**. Consumers import from source: every service references `@pcp/shared` and `@pcp/db/src/schema` / `@pcp/db/src/client` directly. This works because every consuming service uses `tsx` in dev and `tsc` builds emit references that resolve through pnpm's symlinked `node_modules`.

---

## Runtime frameworks

### Backend services (Fastify v4)

Every service runs on **Fastify `^4.26.2`** with the Zod type provider. Common stack:

| Dep                         | Version           | Used by                                    | Notes                                                              |
| --------------------------- | ----------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| `fastify`                   | `^4.26.2`         | all 6 services                             | v4 line, **not** v5                                                |
| `fastify-type-provider-zod` | `^1.1.9`          | all 6 services                             | enables `ZodTypeProvider` + `serializerCompiler/validatorCompiler` |
| `@fastify/cookie`           | `^9.3.1`          | all 6 services                             | session cookies                                                    |
| `@fastify/cors`             | `^9.0.1`          | all 6 services                             |                                                                    |
| `pino`                      | `^8.19.0`         | auth, workspace, runtime, agent, memory    | NOT in `services/publish` (publish has no logger dep declared)     |
| `pino-pretty`               | `^10.3.1`         | all 6 services (devDep)                    | dev-only formatter                                                 |
| `zod`                       | `^3.22.4`         | all 6 services + `@pcp/db` + `@pcp/shared` | v3 line, **not** v4                                                |
| `drizzle-orm`               | mixed (see below) | all 6 services + `@pcp/db`                 | DB access                                                          |

Service-specific Fastify plugins / runtime libs:

| Service                                                             | Extra plugins / runtime deps                                                                                                                                             |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth` ([package.json](../../services/auth/package.json))           | `@fastify/oauth2 ^8.2.0`, `@fastify/rate-limit ^10.3.0`, `argon2 ^0.40.1`                                                                                                |
| `workspace` ([package.json](../../services/workspace/package.json)) | `@fastify/multipart ^8.3.1`, `@fastify/rate-limit ^10.3.0` (declared **but not imported** — see Drift), `@aws-sdk/client-s3 ^3.1037.0`, `@aws-sdk/lib-storage ^3.1037.0` |
| `runtime` ([package.json](../../services/runtime/package.json))     | `@fastify/websocket ^10.0.1`, `dockerode ^4.0.2`                                                                                                                         |
| `agent` ([package.json](../../services/agent/package.json))         | `@anthropic-ai/sdk ^0.91.1`, `openai ^4.28.0`                                                                                                                            |
| `memory` ([package.json](../../services/memory/package.json))       | `openai ^4.28.0` (used for embeddings — see [`src/embeddings/openai.ts`](../../services/memory/src/embeddings/openai.ts))                                                |
| `publish` ([package.json](../../services/publish/package.json))     | `dockerode ^3.3.5`                                                                                                                                                       |

Dev runner: every service runs `tsx watch src/index.ts` for `dev`. There is **no nodemon, ts-node, or esbuild dev script**. `tsx ^4.7.1` is uniform across all services + `@pcp/db`.

### Frontend (`apps/web`)

[`apps/web/package.json`](../../apps/web/package.json) — **Next.js 16 + React 19**.

| Dep                        | Version                    | Purpose                                                                                             |
| -------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------- |
| `next`                     | `16.2.4` (exact)           | App Router, RSC, Turbopack                                                                          |
| `react`, `react-dom`       | `19.2.4` (exact, no caret) | React 19                                                                                            |
| `eslint-config-next`       | `16.2.4` (exact)           | matches Next major                                                                                  |
| `@base-ui/react`           | `^1.4.1`                   | Base UI primitives (used alongside shadcn)                                                          |
| `shadcn`                   | `^4.5.0`                   | declared as a runtime dep — typically a CLI; **likely installed-but-unused at runtime** (see Drift) |
| `@monaco-editor/react`     | `^4.7.0`                   | code editor pane                                                                                    |
| `@xterm/xterm`             | `^6.0.0`                   | terminal pane                                                                                       |
| `@xterm/addon-fit`         | `^0.11.0`                  | xterm sizing                                                                                        |
| `@xterm/addon-web-links`   | `^0.12.0`                  | xterm link parsing                                                                                  |
| `react-resizable-panels`   | `^4.10.0`                  | split panes                                                                                         |
| `@tanstack/react-query`    | `^5.100.5`                 | server state                                                                                        |
| `zustand`                  | `^5.0.12`                  | client state                                                                                        |
| `axios`                    | `^1.15.2`                  | HTTP client                                                                                         |
| `class-variance-authority` | `^0.7.1`                   | variant utility (shadcn pattern)                                                                    |
| `clsx`                     | `^2.1.1`                   | classname helper                                                                                    |
| `tailwind-merge`           | `^3.5.0`                   | merge tailwind class strings                                                                        |
| `tw-animate-css`           | `^1.4.0`                   | tailwind animation utilities                                                                        |
| `lucide-react`             | `^1.11.0`                  | icon set — **suspicious version**, see Drift                                                        |
| `next-themes`              | `^0.4.6`                   | theme switcher                                                                                      |
| `sonner`                   | `^2.0.7`                   | toast                                                                                               |
| `tailwindcss`              | `^4` (devDep)              | Tailwind v4 (CSS-first config)                                                                      |
| `@tailwindcss/postcss`     | `^4` (devDep)              | PostCSS plugin                                                                                      |

Tailwind is **v4** with the new CSS-first config: there is **no `tailwind.config.{js,ts}`**. Theme tokens live in `apps/web/src/app/globals.css`; the only PostCSS plugin is `@tailwindcss/postcss` ([`postcss.config.mjs`](../../apps/web/postcss.config.mjs)). shadcn settings in [`components.json`](../../apps/web/components.json): `style: base-nova`, `iconLibrary: lucide`, `baseColor: neutral`, `rsc: true`, `tsx: true`, alias `@/components`, `@/lib/utils`, etc.

Next.js config ([`next.config.ts`](../../apps/web/next.config.ts)) sets `turbopack.root` to the monorepo root so Turbopack can trace pnpm-linked workspace deps.

---

## Databases & stores

Declared in [`infra/docker/docker-compose.yml`](../../infra/docker/docker-compose.yml) and [`.env.example`](../../infra/docker/.env.example):

| Store                     | Image / port                                      | Wired in code?                                                                                                 | Client / driver                                                                                           |
| ------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Postgres + pgvector**   | `pgvector/pgvector:pg16` on `:5432`               | **Yes** — primary datastore                                                                                    | `postgres ^3.4.4` (postgres.js) + `drizzle-orm` in `@pcp/db`                                              |
| **Redis**                 | `redis:7-alpine` on `:6379` (`--appendonly yes`)  | **No — no client installed**                                                                                   | none of `ioredis`, `redis`, `bullmq` appears in any `package.json`. `REDIS_URL` is in `.env.example` only |
| **MinIO (S3-compatible)** | `minio/minio:latest` on `:9000` / console `:9001` | **Yes, only in `services/workspace`**                                                                          | `@aws-sdk/client-s3 ^3.1037.0` + `@aws-sdk/lib-storage ^3.1037.0`                                         |
| **Mailhog**               | `mailhog/mailhog:latest` on `:1025/:8025`         | **No — no SMTP client installed**                                                                              | no `nodemailer` / `smtp` import anywhere; `SMTP_HOST/PORT` env vars defined but unread                    |
| **Traefik**               | `traefik:v3.0` on `:80/:443/:8080`                | **Inert** — no service container has `labels:` because the Fastify services run on the host, not under compose |

Postgres init script ([`infra/docker/postgres/init.sql`](../../infra/docker/postgres/init.sql)) enables `uuid-ossp`, `pgcrypto`, and `vector` extensions. The `vector` extension is required by the `memory` service (uses `drizzle-orm`'s `sql` template tag for similarity queries — see [`services/memory/src/service.ts`](../../services/memory/src/service.ts)).

Drizzle config ([`packages/db/drizzle.config.ts`](../../packages/db/drizzle.config.ts)):

- `schema: './src/schema/*'` (multi-file)
- `out: './src/migrations'`
- `dialect: 'postgresql'`
- `verbose: true, strict: true`
- DATABASE_URL parsed via Zod at startup.

drizzle-kit is `^0.31.10` (devDep on `@pcp/db` only).

---

## External SDKs

| SDK                    | Version                                 | Imported in                                                                                                                                                                | Purpose                                                                                                                                                                                   |
| ---------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@anthropic-ai/sdk`    | `^0.91.1`                               | [`services/agent/src/llm/anthropic.ts`](../../services/agent/src/llm/anthropic.ts)                                                                                         | Anthropic + Minimax (Minimax exposes an Anthropic-compatible endpoint, configured via `MINIMAX_BASE_URL` and bearer auth — see [`provider.ts`](../../services/agent/src/llm/provider.ts)) |
| `openai`               | `^4.28.0`                               | [`services/agent/src/llm/openai.ts`](../../services/agent/src/llm/openai.ts), [`services/memory/src/embeddings/openai.ts`](../../services/memory/src/embeddings/openai.ts) | OpenAI chat (agent) + text embeddings (memory)                                                                                                                                            |
| `@aws-sdk/client-s3`   | `^3.1037.0`                             | `services/workspace/src/**`                                                                                                                                                | S3/MinIO object operations                                                                                                                                                                |
| `@aws-sdk/lib-storage` | `^3.1037.0`                             | `services/workspace/src/**`                                                                                                                                                | Multipart uploads                                                                                                                                                                         |
| `dockerode`            | `^4.0.2` (runtime) / `^3.3.5` (publish) | [`services/runtime/src/provider/docker.ts`](../../services/runtime/src/provider/docker.ts), `services/publish/src/**`                                                      | Docker daemon (sandbox + deploy)                                                                                                                                                          |
| `argon2`               | `^0.40.1`                               | `services/auth/src/service.ts`                                                                                                                                             | password hashing                                                                                                                                                                          |

**LLM provider abstraction** ([`services/agent/src/llm/provider.ts`](../../services/agent/src/llm/provider.ts)) supports three values for `LLM_PROVIDER`: `openai`, `anthropic`, `minimax` (default fallback `openai`). Defaults: `gpt-4-turbo-preview`, `claude-3-opus-20240229`, `MiniMax-M2.7`.

**Declared in `.env.example` but no SDK installed:**

- `GOOGLE_AI_API_KEY` — no `@google/generative-ai` or equivalent in any `package.json`. Currently dead config.
- `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` — these are consumed by `@fastify/oauth2` in `services/auth`, **not** by a Google SDK. Active.

---

## Testing

| Service              | Test framework | Version      | Test files?                                            |
| -------------------- | -------------- | ------------ | ------------------------------------------------------ |
| `services/auth`      | Vitest         | **`^4.1.5`** | yes (`*.test.ts` under `src/`)                         |
| `services/workspace` | Vitest         | **`^4.1.5`** | yes                                                    |
| `services/runtime`   | Vitest         | `^1.4.0`     | declares script, no test files spotted in import sweep |
| `services/agent`     | Vitest         | `^1.4.0`     | yes                                                    |
| `services/memory`    | Vitest         | `^1.4.0`     | yes                                                    |
| `services/publish`   | Vitest         | `^1.4.0`     | declares script                                        |
| `packages/shared`    | none           | —            | —                                                      |
| `packages/db`        | none           | —            | —                                                      |
| `apps/web`           | none           | —            | —                                                      |

**Vitest version skew:** auth + workspace are on Vitest 4.x; the other four services are on 1.4.x. Vitest's API surface differs across these majors (esp. `vi.mock` semantics, snapshot serializer registration, and config schema). Do **not** unify casually.

No Jest, Playwright, Cypress, Mocha, or Testing Library detected anywhere. There is no E2E or browser-test setup.

---

## Tooling

### Linting

| Where         | Tool                                        | Config                                                                                                                                    | Status                                                                                                         |
| ------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `apps/web`    | ESLint v9 (flat)                            | [`apps/web/eslint.config.mjs`](../../apps/web/eslint.config.mjs) — `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript` | active                                                                                                         |
| `packages/db` | declares `lint: eslint .` in `package.json` | **no `eslint.config.*` or `.eslintrc*` in the package**                                                                                   | **broken** — `pnpm --filter @pcp/db lint` will fail (no installed eslint either; nothing in `devDependencies`) |
| services/\*   | none                                        | —                                                                                                                                         | no service has eslint configured                                                                               |
| root          | none                                        | —                                                                                                                                         | no root eslint config                                                                                          |

### Formatting

[`.prettierrc`](../../.prettierrc): `singleQuote: true`, `semi: true`, `trailingComma: 'all'`, `printWidth: 100`, `tabWidth: 2`, `arrowParens: 'always'`, `endOfLine: 'lf'`. Prettier `^3.2.0` is a root devDependency.

### Build / dev tooling

| Tool                                   | Version                                         | Used in                                             |
| -------------------------------------- | ----------------------------------------------- | --------------------------------------------------- |
| `tsx`                                  | `^4.7.1`                                        | every service + `@pcp/db` (dev runner + seed)       |
| `tsc` (TypeScript)                     | `^5.4.0`–`^5.4.2` (services + libs), `^5` (web) | `build` step everywhere except web                  |
| `next`                                 | `16.2.4`                                        | `apps/web` (dev/build/start via Turbopack)          |
| `drizzle-kit`                          | `^0.31.10`                                      | `@pcp/db` only — generate / migrate / push / studio |
| `tailwindcss` + `@tailwindcss/postcss` | `^4`                                            | `apps/web` (CSS-first, no JS config)                |

### CI / CD

**No CI configured.** `.github/` does not exist. There are no GitLab CI, CircleCI, Buildkite, or other pipeline files. Builds, lint, tests, and migrations are all developer-local.

---

## Infra (compose)

[`infra/docker/docker-compose.yml`](../../infra/docker/docker-compose.yml) defines five services on a single `pcp-network` bridge with three named volumes (`postgres_data`, `redis_data`, `minio_data`):

| Service    | Image                    | Ports                    | Healthcheck               | Volumes                                                              |
| ---------- | ------------------------ | ------------------------ | ------------------------- | -------------------------------------------------------------------- |
| `postgres` | `pgvector/pgvector:pg16` | `5432:5432`              | `pg_isready`              | `postgres_data:/var/lib/postgresql/data`, `./postgres/init.sql` (ro) |
| `redis`    | `redis:7-alpine`         | `6379:6379`              | `redis-cli ping`          | `redis_data:/data`                                                   |
| `minio`    | `minio/minio:latest`     | `9000:9000`, `9001:9001` | `curl /minio/health/live` | `minio_data:/data`                                                   |
| `traefik`  | `traefik:v3.0`           | `80`, `443`, `8080`      | none                      | `/var/run/docker.sock` (ro)                                          |
| `mailhog`  | `mailhog/mailhog:latest` | `1025`, `8025`           | none                      | none                                                                 |

**Compose-version note:** the file declares `version: "3.9"`, which Compose v2 considers obsolete (still works, prints a warning). The Fastify services and Next app are **not** in compose — they run on the host via `pnpm dev`. As a result Traefik has no labelled targets and is effectively unused right now.

`.env.example` lives at [`infra/docker/.env.example`](../../infra/docker/.env.example); the actual `infra/docker/.env` is gitignored.

---

## Drift & gotchas

### Version drift

- **`drizzle-orm` is split between pinned and `latest`.**
  - Pinned `^0.45.2`: `@pcp/db`, `services/auth`, `services/workspace`.
  - **Unpinned `latest`**: `services/runtime`, `services/agent`, `services/memory`, `services/publish`. This means a fresh install can pull a major upgrade out from under those services without warning. The lockfile currently masks the divergence; any `pnpm update` could break them.
- **`vitest` skew**: `^4.1.5` (auth, workspace) vs `^1.4.0` (runtime, agent, memory, publish). Three majors apart.
- **`dockerode` skew**: `^4.0.2` in runtime vs `^3.3.5` in publish; `@types/dockerode` likewise (`^3.3.29` vs `^3.3.24`).
- **TypeScript caret looseness**: web on `^5` (any 5.x), services on `^5.4.2`, root on `^5.4.0`. Nothing has bitten yet, but a 5.x patch could surface differently across packages.
- **`lucide-react ^1.11.0`** in `apps/web` is suspicious. The published `lucide-react` line is on `0.x` (currently ~0.460). A `^1.11.0` install will resolve to whatever 1.x is published (a different package version line, possibly a phantom or yanked range). Worth verifying against the lockfile and re-pinning to a known good 0.x.

### Installed-but-unused

- **`@fastify/rate-limit`** is a dep of `services/workspace` but is **never imported** there (only `services/auth` actually wires it). Either remove it from workspace or actually apply rate limiting in workspace routes.
- **`shadcn ^4.5.0`** as a runtime dependency of `apps/web`. shadcn is a CLI scaffolder; the components it generates are vendored into `src/components/ui/`. The package itself is not imported at runtime. Likely should be a devDependency (or removed entirely once components are generated).
- **`tw-animate-css ^1.4.0`** — declared, but no quick evidence of import in component sweeps. Worth grep-confirming before keeping.

### Declared-but-not-wired infrastructure

- **Redis**: container runs, `REDIS_URL` is in `.env.example`, and `AGENTS.md` references "Redis pub/sub / BullMQ" for inter-service communication, but **no Redis or BullMQ client is installed in any `package.json`**. There is no queue, no pub/sub, no cache implementation today.
- **Mailhog**: container runs, `SMTP_HOST` / `SMTP_PORT` are in `.env.example`, but **no `nodemailer` / SMTP client is installed**. Nothing sends mail.
- **Traefik**: running but has zero targets — host-mode services don't pick up Traefik labels. Currently inert.
- **`GOOGLE_AI_API_KEY`** in `.env.example` has no consumer (no Google AI SDK installed).

### Misc

- `packages/db/tsconfig.json` overrides the base to `module: CommonJS` + `moduleResolution: Node`. Drizzle-kit needs CJS, so this is intentional, but it's the one place in the repo not following the ESNext/Bundler base.
- `packages/shared` has `main: ./src/index.ts` — there is no build output. Every consumer imports from source via pnpm symlinks. Don't add a `build` step here without also updating every consumer's import paths.
- `apps/web` package name is `web`, not `@pcp/web`. Filter commands must use `--filter web`.
- The repo path on disk contains spaces (`untitled folder/...`). Quote paths in shell commands.
- README references `apps/api` and "API at :4000" — **stale**. There is no `apps/api`; the backend is split across the six services in `services/*`. (`AGENTS.md` already calls this out.)

---

_Generated by gsd-map-codebase, focus=tech_
