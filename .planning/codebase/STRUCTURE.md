---
focus: arch
mapped_at: 2026-04-27
last_mapped_commit: c55e9b3bb8f13d990887889dfeb3418507c7a360
---

# Structure

## Root

- `package.json`: root scripts and workspace metadata.
- `pnpm-workspace.yaml`: includes `packages/*`, `services/*`, `apps/*`.
- `tsconfig.base.json`: strict shared TypeScript config for backend packages.
- `README.md`: product overview and startup instructions; some roadmap claims are stale relative to code.
- `AGENTS.md`: repo-specific coding and GSD instructions.
- `.cursor/rules/*.mdc`: architecture, backend, database, security, sandbox, testing, frontend, and agent invariants.
- `infra/docker`: local infrastructure stack.

## Frontend

- `apps/web/package.json`: Next.js 16 frontend dependencies and scripts.
- `apps/web/AGENTS.md`: warns to consult local Next 16 docs before routing/config changes.
- `apps/web/src/app`: App Router routes.
- `apps/web/src/app/(auth)`: login and register pages.
- `apps/web/src/app/(main)`: protected product modules.
- `apps/web/src/components/app-shell`: shell, sidebar, command palette, chat home, identity bar.
- `apps/web/src/components/workspace`: file tree, editor, terminal, chat, workspace shell.
- `apps/web/src/components/ui`: local UI primitives.
- `apps/web/src/lib`: API clients, auth hooks, formatting, utilities.
- `apps/web/src/store`: Zustand workspace store.
- `apps/web/src/proxy.ts`: auth-cookie redirect middleware.

## Services

Each service is a separate package under `services/*`.

### `services/auth`

- `src/index.ts`: Fastify app on port 3001, `/auth` prefix.
- `src/routes.ts`: register, login, me, refresh, logout, Google OAuth.
- `src/routes/profile.ts`: preferences and provider credentials.
- `src/routes/admin.ts`: users, audit logs, health.
- `src/service.ts`: auth logic, session lifecycle, audit logging.
- `src/encryption.ts`: AES-256-GCM helper for provider keys.
- Tests: `src/service.test.ts`, `src/__tests__/encryption.test.ts`, `src/__tests__/schemas.test.ts`.

### `services/workspace`

- `src/index.ts`: Fastify app on port 3002, `/api` prefix, multipart enabled.
- `src/routes.ts`: workspace CRUD, files, upload, move/delete.
- `src/routes/snapshots.ts`: snapshot create/list/restore.
- `src/service.ts`: S3 storage wrapper, workspace/file logic, snapshots.
- Tests: `src/service.test.ts`, `src/__tests__/path-traversal.test.ts`.

### `services/runtime`

- `src/index.ts`: Fastify app on port 3003, `/api` prefix, websocket plugin.
- `src/routes.ts`: create/start/stop/exec/delete/terminal.
- `src/service.ts`: runtime lifecycle and command execution.
- `src/provider/docker.ts`: Dockerode implementation.
- `src/provider/types.ts`: runtime provider interfaces.

### `services/agent`

- `src/index.ts`: Fastify app on port 3004, `/api` prefix, automation worker startup.
- `src/routes.ts`: chat, tasks, steps, conversations, tool approvals.
- `src/routes/automation.ts`: automation CRUD, manual runs, run history.
- `src/orchestrator.ts`: LLM loop, task persistence, tool dispatch.
- `src/llm`: OpenAI, Anthropic, Minimax-compatible provider code.
- `src/tools`: tool definitions and registry.
- `src/automation/queue.ts`: BullMQ queue and worker.
- Test: `src/orchestrator.test.ts`.

### `services/memory`

- `src/index.ts`: Fastify app on port 3005, `/api` prefix.
- `src/routes.ts`: add, search, update, delete memory.
- `src/service.ts`: embeddings and pgvector search.
- `src/embeddings`: OpenAI embedding provider abstraction.
- Test: `src/service.test.ts`.

### `services/publish`

- `src/index.ts`: Fastify app on port 3006, `/publish` prefix.
- `src/routes.ts`: hosted service CRUD and lifecycle actions.
- `src/service.ts`: hosted service persistence and Docker/Traefik launch.

## Packages

### `packages/db`

- `src/client.ts`: Drizzle database client and health check.
- `src/schema/*.ts`: table definitions.
- `src/migrations`: generated SQL and snapshots.
- `src/seed.ts`: seed script.
- `drizzle.config.ts`: migration config with Zod env validation.

### `packages/shared`

- `src/auth.ts`: register/login/auth response schemas.
- `src/workspace.ts`: workspace/file schemas.
- `src/runtime.ts`: runtime schemas.
- `src/agent.ts`: task, step, conversation, tool approval schemas.
- `src/memory.ts`: memory schemas.
- `src/automation.ts`: automation schemas.
- `src/hosting.ts`: hosted service schemas.
- `src/snapshot.ts`: snapshot schemas.
- `src/settings.ts`: preferences, provider credential, audit schemas.
- `src/index.ts`: barrel exports.

## Generated Or Build Artifacts Present

- `services/*/dist` exists for several services.
- `*.tsbuildinfo` files exist under services and packages.
- These files should be reviewed for git tracking expectations before cleanup.

