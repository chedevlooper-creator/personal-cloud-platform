# Codebase Structure

**Analysis Date:** 2026-04-27

## Directory Layout

```text
personal-cloud-platform/
|-- apps/
|   `-- web/                 # Next.js 16 / React 19 frontend
|-- services/
|   |-- auth/                # Identity, sessions, OAuth, profile/admin settings
|   |-- workspace/           # Workspaces, files, S3 storage, snapshots
|   |-- runtime/             # Docker-backed runtime and terminal APIs
|   |-- agent/               # LLM orchestration, tools, automations
|   |-- memory/              # pgvector memory entries and semantic search
|   `-- publish/             # Hosted services through Docker and Traefik
|-- packages/
|   |-- db/                  # Drizzle schema, migrations, seed, DB client
|   `-- shared/              # Zod DTOs imported directly from source
|-- infra/
|   `-- docker/              # Local Postgres, Redis, MinIO, Traefik, Mailhog
|-- docs/                    # Build plan, ADRs, production guide, progress
|-- scripts/                 # Setup scripts
|-- .cursor/rules/           # Repo invariants for architecture/security/testing
|-- .codex/                  # GSD/Codex workflow assets
|-- .planning/               # GSD planning and codebase map
|-- package.json             # Root workspace scripts
|-- pnpm-workspace.yaml      # Workspace package globs
`-- tsconfig.base.json       # Shared strict TypeScript config
```

## Directory Purposes

**`apps/web`:**
- Purpose: Browser UI for the cloud workspace.
- Contains: App Router pages, app shell components, workspace UI, API clients, hooks, Zustand store.
- Key files: `apps/web/src/app/(main)/layout.tsx`, `apps/web/src/components/app-shell/app-shell.tsx`, `apps/web/src/lib/api.ts`.

**`services/auth`:**
- Purpose: Registration, login, OAuth, session refresh/logout, profile/settings/admin routes.
- Contains: `src/index.ts`, `src/routes.ts`, route modules under `src/routes/`, `AuthService`, encryption helpers, tests.

**`services/workspace`:**
- Purpose: Workspace CRUD, file metadata/content, upload/download, path safety, snapshots.
- Contains: `src/routes.ts`, `src/service.ts`, `src/routes/snapshots.ts`, tests for service and path traversal.

**`services/runtime`:**
- Purpose: Runtime lifecycle, Docker exec, terminal WebSocket.
- Contains: `src/provider/types.ts`, `src/provider/docker.ts`, `src/service.ts`, `src/routes.ts`.

**`services/agent`:**
- Purpose: LLM provider abstraction, agent task loop, tool registry, automations.
- Contains: `src/orchestrator.ts`, `src/llm/*`, `src/tools/*`, `src/automation/queue.ts`, route modules.

**`services/memory`:**
- Purpose: Add/update/delete/search long-term memory entries with pgvector.
- Contains: `src/service.ts`, `src/routes.ts`, `src/embeddings/*`, tests.

**`services/publish`:**
- Purpose: Create/start/stop/delete hosted services and wire Docker containers to Traefik.
- Contains: `src/service.ts`, `src/routes.ts`, service entry point.

**`packages/db`:**
- Purpose: Single owner of database access and schema.
- Contains: Drizzle schema in `src/schema/`, migrations in `src/migrations/`, client in `src/client.ts`, seed script.

**`packages/shared`:**
- Purpose: Shared Zod schemas and inferred DTOs.
- Contains: `src/auth.ts`, `workspace.ts`, `runtime.ts`, `agent.ts`, `memory.ts`, `automation.ts`, `hosting.ts`, `snapshot.ts`, `settings.ts`.

**`infra/docker`:**
- Purpose: Local development dependencies and database extension initialization.
- Contains: `docker-compose.yml`, `.env.example`, `postgres/init.sql`.

## Key File Locations

**Entry Points:**
- `apps/web/src/app/layout.tsx`: frontend root layout.
- `services/*/src/index.ts`: service startup files.
- `packages/db/src/client.ts`: DB connection creation.

**Configuration:**
- `package.json`: root commands and workspace requirements.
- `pnpm-workspace.yaml`: workspace package globs.
- `tsconfig.base.json`: strict TypeScript base.
- `apps/web/next.config.ts`: Next.js config.
- `packages/db/drizzle.config.ts`: Drizzle migration config.
- `infra/docker/.env.example`: local infra env template.

**Core Logic:**
- `services/auth/src/service.ts`: auth/session/OAuth logic.
- `services/workspace/src/service.ts`: workspace/file/snapshot logic.
- `services/runtime/src/service.ts`: runtime lifecycle and command execution.
- `services/agent/src/orchestrator.ts`: agent loop and task persistence.
- `services/memory/src/service.ts`: memory CRUD/search.
- `services/publish/src/service.ts`: Docker-based hosting.

**Testing:**
- `services/auth/src/service.test.ts`
- `services/auth/src/__tests__/encryption.test.ts`
- `services/auth/src/__tests__/schemas.test.ts`
- `services/workspace/src/service.test.ts`
- `services/workspace/src/__tests__/path-traversal.test.ts`
- `services/agent/src/orchestrator.test.ts`
- `services/memory/src/service.test.ts`

**Documentation:**
- `README.md`: product overview, commands, current roadmap claim.
- `AGENTS.md`: repo-specific agent instructions.
- `docs/DECISIONS.md`: ADR-lite decisions.
- `docs/PRODUCTION.md`: production guide and hardening checklist.

## Naming Conventions

**Files:**
- Services mostly use simple module names such as `service.ts`, `routes.ts`, `index.ts`.
- Test files are colocated as `*.test.ts` or under `src/__tests__/`.
- Frontend components use kebab-case filenames under feature directories.

**Directories:**
- Workspace packages live under `apps/*`, `services/*`, and `packages/*`.
- Service source code lives under `services/<name>/src`.
- Route submodules live under `services/<name>/src/routes/` when needed.

**Special Patterns:**
- `packages/shared/src/index.ts` re-exports DTO modules.
- `packages/db/src/schema/index.ts` re-exports schema modules.
- `dist/` and `*.tsbuildinfo` exist for some packages but are build artifacts.

## Where to Add New Code

**New Service Route:**
- Route schema: `packages/shared/src/<domain>.ts` if shared.
- Route handler: `services/<service>/src/routes.ts` or `services/<service>/src/routes/<feature>.ts`.
- Business logic: `services/<service>/src/service.ts` or a new focused service module.
- Tests: colocated `*.test.ts`.

**New Database Table:**
- Schema: `packages/db/src/schema/<table-group>.ts`.
- Barrel export: `packages/db/src/schema/index.ts`.
- Migration: generated into `packages/db/src/migrations/`.

**New Frontend Module:**
- Page: `apps/web/src/app/(main)/<route>/page.tsx`.
- Shared UI: `apps/web/src/components/ui/`.
- Feature component: `apps/web/src/components/<feature>/`.
- API client additions: `apps/web/src/lib/api.ts`.

**New Agent Tool:**
- Tool implementation: `services/agent/src/tools/<tool>.ts`.
- Registration: `services/agent/src/orchestrator.ts`.
- Shared DTOs as needed: `packages/shared/src/agent.ts`.

## Special Directories

**`.cursor/rules`:**
- Purpose: executable project invariants for future agents.
- Committed: yes.

**`.codex`:**
- Purpose: GSD/Codex skills, agents, hooks, and workflow assets.
- Committed: currently tracked and modified by local installer.

**`.planning`:**
- Purpose: GSD project context, codebase maps, requirements, roadmap, state.
- Committed: intended by default config.

**`dist`:**
- Purpose: TypeScript build output for services and packages.
- Committed: currently present in some services; root `.gitignore` also ignores `dist/`, so treat carefully.

---
*Structure analysis: 2026-04-27*
*Update when directory structure changes*
