# CloudMind OS — Code Wiki

This document describes the codebase structure and key implementation concepts for the CloudMind OS monorepo (aka “personal-cloud-platform”).

## Contents

- [Project Overview](#project-overview)
- [Repository Layout](#repository-layout)
- [Architecture](#architecture)
- [Shared Packages](#shared-packages)
- [Backend Services](#backend-services)
- [Frontend (Next.js Web App)](#frontend-nextjs-web-app)
- [Dependency Relationships](#dependency-relationships)
- [Running Locally](#running-locally)
- [Testing](#testing)

## Project Overview

CloudMind OS is a multi-tenant, browser-based “AI cloud computer”:

- A Next.js web UI
- A set of Fastify microservices (Auth, Workspace, Runtime, Agent, Memory, Publish, Browser)
- Shared packages for database schema/access and shared DTOs/utilities
- Local infrastructure (Postgres + pgvector, Redis, MinIO, Traefik, Mailhog) via Docker Compose

For product/ops docs already in-repo:

- [AGENT.md](file:///workspace/docs/AGENT.md)
- [DATA_MODEL.md](file:///workspace/docs/DATA_MODEL.md)
- [PRODUCTION.md](file:///workspace/docs/PRODUCTION.md)
- [DECISIONS.md](file:///workspace/docs/DECISIONS.md)

## Repository Layout

Monorepo/workspaces:

- Root scripts and workspace config: [package.json](file:///workspace/package.json), [pnpm-workspace.yaml](file:///workspace/pnpm-workspace.yaml)

Primary code:

- Frontend app: [apps/web](file:///workspace/apps/web)
- Backend services: [services](file:///workspace/services)
- Shared packages:
  - DB schema + client: [packages/db](file:///workspace/packages/db)
  - Shared types/utilities: [packages/shared](file:///workspace/packages/shared)
- Local infra: [infra/docker](file:///workspace/infra/docker)
- Utility scripts: [scripts](file:///workspace/scripts)

## Architecture

### High-level diagram

The README contains an accurate, current Mermaid diagram of service dependencies:

- [README.md](file:///workspace/README.md#L116-L160)

### Service boundaries

The system intentionally separates concerns:

- Auth handles identity, sessions, OAuth, and user/admin surfaces.
- Workspace owns “workspace state”: metadata in Postgres plus file objects in S3 (MinIO).
- Runtime owns safe command execution / terminal runtimes via Docker sandbox.
- Agent owns the LLM loop, task lifecycle, tool execution, approvals, and automation scheduling.
- Memory owns vector search (pgvector) and embedding generation.
- Publish owns “hosting”: materialize workspace → run a container → expose it via Traefik.
- Browser owns cloud browser sessions (Playwright) with SSRF/network safety checks.

## Shared Packages

### `@pcp/db` (Database access + schema)

Location: [packages/db](file:///workspace/packages/db)

Responsibilities:

- Drizzle schema definitions for all tables: [schema/index.ts](file:///workspace/packages/db/src/schema/index.ts)
- Migrations and pgvector index creation: [migrations](file:///workspace/packages/db/src/migrations)
- DB client initialization, env validation, and health check: [client.ts](file:///workspace/packages/db/src/client.ts)

Key exports:

- `db`: Drizzle client bound to the schema ([client.ts](file:///workspace/packages/db/src/client.ts#L31))
- `checkDbHealth()`: simple query-based health probe ([client.ts](file:///workspace/packages/db/src/client.ts#L34-L42))

Notes:

- The DB client loads Docker infra defaults first (`infra/docker/.env`), then root `.env`, enabling easy local runs while still supporting overrides ([client.ts](file:///workspace/packages/db/src/client.ts#L8-L11)).

### `@pcp/shared` (Cross-service types + helpers)

Location: [packages/shared](file:///workspace/packages/shared)

Responsibilities:

- Shared DTOs for HTTP APIs (Zod schemas and types)
- Shared infrastructure helpers used across services (CORS/rate-limit configs, error envelope, observability)

Key modules:

- Error envelope + Fastify error handler:
  - `createApiErrorHandler()` emits `{ error: { code, message, correlationId } }` and avoids leaking internal errors on 5xx ([errors.ts](file:///workspace/packages/shared/src/errors.ts#L91-L108))
  - `sendApiError()` helper for early-return error responses ([errors.ts](file:///workspace/packages/shared/src/errors.ts#L114-L124))
- Observability (Prometheus):
  - `registerObservability()` adds `/metrics` + HTTP counters/histogram/gauge ([observability.ts](file:///workspace/packages/shared/src/observability.ts#L56-L134))
  - `createCorrelationIdGenerator()` standardizes incoming/outgoing correlation ids and bounds header abuse ([observability.ts](file:///workspace/packages/shared/src/observability.ts#L23-L36))
  - `withCorrelationHeaders()` helps propagate correlation ids in outbound HTTP calls ([observability.ts](file:///workspace/packages/shared/src/observability.ts#L140-L149))

## Backend Services

All backend services are TypeScript Fastify apps under [services](file:///workspace/services), each with a similar shape:

- `src/index.ts`: bootstraps Fastify, registers routes, health checks, shared error handler/observability
- `src/env.ts`: Zod-validated environment
- `src/routes.ts` (+ `src/routes/*`): request/response schemas and handler wiring
- `src/service.ts`: the main “service layer” class that encapsulates domain logic and DB access

### Auth Service (`:3001`)

Location: [services/auth](file:///workspace/services/auth)
Entrypoint: [index.ts](file:///workspace/services/auth/src/index.ts)

Responsibilities:

- Registration/login with Argon2 password hashing
- Session cookies and session validation
- Google OAuth linking and encrypted token storage
- Admin endpoints gated by `ADMIN_EMAIL`

Key class:

- `AuthService` ([service.ts](file:///workspace/services/auth/src/service.ts#L17))
  - `register()` inserts user + creates session ([service.ts](file:///workspace/services/auth/src/service.ts#L45-L81))
  - `login()` verifies password + creates session ([service.ts](file:///workspace/services/auth/src/service.ts#L83-L119))
  - `handleOAuthLogin()` upserts OAuth account + encrypts tokens ([service.ts](file:///workspace/services/auth/src/service.ts#L121-L202))
  - `validateSession()` returns user id (or null), refreshing expiration when close to expiry ([service.ts](file:///workspace/services/auth/src/service.ts#L204-L220))

Related:

- Admin routes: [routes/admin.ts](file:///workspace/services/auth/src/routes/admin.ts)

### Workspace Service (`:3002`)

Location: [services/workspace](file:///workspace/services/workspace)
Entrypoint: [index.ts](file:///workspace/services/workspace/src/index.ts)

Responsibilities:

- Workspace CRUD + workspace file tree records in Postgres
- S3-backed file object storage (MinIO in dev)
- Workspace snapshots (backup/restore) as gzipped bundles in object storage
- Dataset support via a driver module under `src/datasets/*`

Key types/classes:

- `WorkspaceObjectStorage` abstraction for object storage operations ([service.ts](file:///workspace/services/workspace/src/service.ts#L25-L36))
- `S3WorkspaceObjectStorage` (S3 implementation) ([service.ts](file:///workspace/services/workspace/src/service.ts#L48-L173))
- `WorkspaceError` for status-coded failures ([service.ts](file:///workspace/services/workspace/src/service.ts#L38-L46))
- `WorkspaceService` ([service.ts](file:///workspace/services/workspace/src/service.ts#L223))
  - `assertSafePath()` blocks traversal attempts (`..`, null bytes, `~`) before any file operation ([service.ts](file:///workspace/services/workspace/src/service.ts#L233-L239))
  - `createWorkspace()` seeds starter files after workspace creation ([service.ts](file:///workspace/services/workspace/src/service.ts#L255-L268))
  - `listUserWorkspaces()` auto-provisions a default workspace on first access ([service.ts](file:///workspace/services/workspace/src/service.ts#L270-L295))
  - `listFiles()` maps DB `workspace_files` rows into a hierarchical listing ([service.ts](file:///workspace/services/workspace/src/service.ts#L312-L327))

### Runtime Service (`:3003`)

Location: [services/runtime](file:///workspace/services/runtime)
Entrypoint: [index.ts](file:///workspace/services/runtime/src/index.ts)

Responsibilities:

- Create/start/stop Docker-backed “runtimes” per workspace
- Execute commands in a running runtime with a configurable security policy
- Sync files between workspace storage and the runtime host directory
- Record runtime events/logs for auditability

Key class:

- `RuntimeService` ([service.ts](file:///workspace/services/runtime/src/service.ts#L23))
  - `createRuntime()` persists runtime → provisions Docker container with labels → emits `runtimeEvents` ([service.ts](file:///workspace/services/runtime/src/service.ts#L72-L151))
  - `execCommand()` enforces command policy before execution ([service.ts](file:///workspace/services/runtime/src/service.ts#L201-L217))

Important security modules:

- Policy enforcement:
  - `assertRuntimeImageAllowed()` / `assertRuntimeCommandAllowed()` ([policy.ts](file:///workspace/services/runtime/src/policy.ts))
- Docker provider interface:
  - Provider types: [provider/types.ts](file:///workspace/services/runtime/src/provider/types.ts)
  - Docker implementation: [provider/docker.ts](file:///workspace/services/runtime/src/provider/docker.ts)

### Agent Service (`:3004`)

Location: [services/agent](file:///workspace/services/agent)
Entrypoint: [index.ts](file:///workspace/services/agent/src/index.ts)

Responsibilities:

- Chat/task orchestration (LLM requests, tool calls, streaming events)
- Tool execution with approval gates
- Queue-backed automations (BullMQ via Redis)
- Skills/personas catalog + user preferences
- Integrations “channels” (e.g., Telegram webhook adapter)

Key classes:

- `AgentOrchestrator` ([orchestrator.ts](file:///workspace/services/agent/src/orchestrator.ts#L48))
  - Owns LLM provider selection (`createLLMProvider`) and tool registry wiring ([orchestrator.ts](file:///workspace/services/agent/src/orchestrator.ts#L55-L81))
  - Builds `ToolContext` to pass user/workspace/task identity and HTTP clients into tools ([orchestrator.ts](file:///workspace/services/agent/src/orchestrator.ts#L83-L92))
  - Tracks per-task runtime ids to avoid repeated provisioning calls ([orchestrator.ts](file:///workspace/services/agent/src/orchestrator.ts#L94-L98))
- `ToolRegistry` ([tools/registry.ts](file:///workspace/services/agent/src/tools/registry.ts#L32))
  - Central execution API for tools, with strict JSON parsing and Zod validation ([tools/registry.ts](file:///workspace/services/agent/src/tools/registry.ts#L51-L78))
  - Enforces approval gating via `requiresApproval` ([tools/registry.ts](file:///workspace/services/agent/src/tools/registry.ts#L58-L60))

How tools are implemented:

- Each tool implements `Tool<TInput, TOutput>` with:
  - `schema` (Zod input validation)
  - `requiresApproval` (UI/flow safety)
  - `execute()` (side effects allowed based on approval)
- Tools are registered centrally in the orchestrator constructor (e.g., `ReadFileTool`, `RunCommandTool`, browser tools) ([orchestrator.ts](file:///workspace/services/agent/src/orchestrator.ts#L64-L81))

### Memory Service (`:3005`)

Location: [services/memory](file:///workspace/services/memory)
Entrypoint: [index.ts](file:///workspace/services/memory/src/index.ts)

Responsibilities:

- Add/search/update/delete memory entries stored in Postgres
- Vector similarity search via pgvector (HNSW index created in migrations)
- Embedding provider selection (OpenAI if configured, otherwise deterministic local hashing)

Key class:

- `MemoryService` ([service.ts](file:///workspace/services/memory/src/service.ts#L39))
  - Provider selection: OpenAI vs local hash embeddings ([service.ts](file:///workspace/services/memory/src/service.ts#L42-L56))
  - `addMemory()` inserts the entry plus embedding ([service.ts](file:///workspace/services/memory/src/service.ts#L67-L90))
  - `searchMemory()` runs raw SQL with `embedding <-> vector` ordering and exposes a computed similarity score ([service.ts](file:///workspace/services/memory/src/service.ts#L92-L139))

### Publish Service (`:3006`)

Location: [services/publish](file:///workspace/services/publish)
Entrypoint: [index.ts](file:///workspace/services/publish/src/index.ts)

Responsibilities:

- “Hosting” workflows:
  - Validate/normalize hosted service config (slug, root path, env vars)
  - Materialize workspace contents into a Docker volume
  - Run an app container and expose it through Traefik routing
- Encrypt/decrypt env vars; redact for logs/UI

Key class:

- `PublishService` ([service.ts](file:///workspace/services/publish/src/service.ts#L33))
  - `createService()` normalizes inputs, encrypts env vars, persists to DB ([service.ts](file:///workspace/services/publish/src/service.ts#L43-L83))
  - `startService()` flips status and triggers async container startup ([service.ts](file:///workspace/services/publish/src/service.ts#L116-L135))
  - `runContainer()` creates a container with Traefik labels like `Host(\`${slug}.apps.localhost\`)` ([service.ts](file:///workspace/services/publish/src/service.ts#L166-L214))

### Browser Service (`:3007`)

Location: [services/browser](file:///workspace/services/browser)
Entrypoint: [index.ts](file:///workspace/services/browser/src/index.ts)

Responsibilities:

- Cloud browser sessions per user (Playwright contexts/pages)
- SSRF / private-network navigation protection for agent/browser workflows
- Session lifecycle management (idle timeouts, per-user limits)

Key class:

- `BrowserService` ([service.ts](file:///workspace/services/browser/src/service.ts#L45))
  - `createSession()` starts a persistent Chromium context and applies a global route guard to block unsafe destinations ([service.ts](file:///workspace/services/browser/src/service.ts#L62-L101))
  - `navigate()`, `click()`, `fill()` provide controlled interaction primitives ([service.ts](file:///workspace/services/browser/src/service.ts#L103-L135))
  - `extract()` returns trimmed visible text plus a bounded set of links for LLM consumption ([service.ts](file:///workspace/services/browser/src/service.ts#L144-L182))

Playwright is optional:

- The service loads Playwright via dynamic import and returns a helpful install message when missing ([service.ts](file:///workspace/services/browser/src/service.ts#L32-L43)).

## Frontend (Next.js Web App)

Location: [apps/web](file:///workspace/apps/web)

Responsibilities:

- App Router UI surfaces for the modules described in the root README (dashboard, files, chats, terminal, hosting, automations, etc.)
- API client wrappers, auth hooks, state stores (Zustand), and UI components (shadcn/ui)

Key modules:

- API client layer:
  - Default service endpoints are configured via `NEXT_PUBLIC_*_API_URL` with localhost fallbacks ([api.ts](file:///workspace/apps/web/src/lib/api.ts#L4-L10))
  - `ApiError` is a typed error that maps the shared backend error envelope into a stable client-side shape ([api.ts](file:///workspace/apps/web/src/lib/api.ts#L18-L28))
  - Axios interceptors add `x-correlation-id` and translate API error envelopes into `ApiError` ([api.ts](file:///workspace/apps/web/src/lib/api.ts#L40-L92))
  - `toastApiError()` displays a toast and includes correlation id for support triage ([api.ts](file:///workspace/apps/web/src/lib/api.ts#L170-L176))
- Auth hooks:
  - `useUser`, `useLogin`, `useRegister`, `useLogout` wrap either Supabase (optional) or the Auth service HTTP API ([auth.ts](file:///workspace/apps/web/src/lib/auth.ts#L8-L81))
- UI entrypoints:
  - App router pages: [src/app](file:///workspace/apps/web/src/app)
  - App shell components: [components/app-shell](file:///workspace/apps/web/src/components/app-shell)

## Dependency Relationships

### Runtime/data dependencies

Shared dependencies:

- All services that touch Postgres import `db` + schema from `@pcp/db` (e.g., [AuthService](file:///workspace/services/auth/src/service.ts#L1-L3), [MemoryService](file:///workspace/services/memory/src/service.ts#L1-L3)).
- Most services adopt the shared error envelope and correlation id conventions from `@pcp/shared` (see [errors.ts](file:///workspace/packages/shared/src/errors.ts) and [observability.ts](file:///workspace/packages/shared/src/observability.ts)).

Infra dependencies (local/dev defaults):

- Postgres + pgvector: [infra/docker/docker-compose.yml](file:///workspace/infra/docker/docker-compose.yml#L6-L26)
- Redis (BullMQ backing store): [infra/docker/docker-compose.yml](file:///workspace/infra/docker/docker-compose.yml#L27-L43)
- MinIO (S3): [infra/docker/docker-compose.yml](file:///workspace/infra/docker/docker-compose.yml#L44-L64)
- Traefik (proxy + hosted apps network): [infra/docker/docker-compose.yml](file:///workspace/infra/docker/docker-compose.yml#L65-L84)

### Request flow examples

Authentication + session:

- Web app sends login/register to Auth with `withCredentials: true` so cookies persist ([api.ts](file:///workspace/apps/web/src/lib/api.ts#L94-L106)).
- Backend services validate session cookies via `validateSessionUserId` from `@pcp/db` (e.g., [AgentOrchestrator](file:///workspace/services/agent/src/orchestrator.ts#L15-L16), [RuntimeService](file:///workspace/services/runtime/src/service.ts#L33-L35)).

Agent tool execution:

- The Agent service receives chat/task input, chooses an LLM provider, and emits tool calls.
- Tools execute via `ToolRegistry.execute*()` which parses JSON, validates inputs via Zod, and enforces approval on unsafe tools ([registry.ts](file:///workspace/services/agent/src/tools/registry.ts#L51-L78)).
- Tools call other services through typed HTTP clients under [services/agent/src/clients](file:///workspace/services/agent/src/clients).

## Running Locally

Primary setup instructions are in:

- [README.md](file:///workspace/README.md#L34-L115)

Summary:

1. Prerequisites
   - Node.js 20+
   - pnpm 9+
   - Docker + Docker Compose
2. Install dependencies

   ```bash
   pnpm install
   ```

3. Configure infra environment

   ```bash
   cp infra/docker/.env.example infra/docker/.env
   ```

4. Start infrastructure

   ```bash
   pnpm infra:up
   ```

5. Run DB migrations + seed

   ```bash
   pnpm --filter @pcp/db migrate
   pnpm --filter @pcp/db seed
   ```

6. Start everything

   ```bash
   pnpm dev
   ```

Key local URLs:

- App: http://localhost:3000
- Traefik dashboard: http://localhost:8080
- MinIO console: http://localhost:9001
- Mailhog: http://localhost:8025

## Testing

Root smoke test:

- `pnpm smoke:local` ([baseline-smoke.mjs](file:///workspace/scripts/baseline-smoke.mjs))

Common commands:

- `pnpm test` (runs package-level tests where configured) ([package.json](file:///workspace/package.json#L10-L11))
- `pnpm typecheck` ([package.json](file:///workspace/package.json#L11-L11))
