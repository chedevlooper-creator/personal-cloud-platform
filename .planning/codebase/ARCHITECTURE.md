# Architecture

**Analysis Date:** 2026-04-27

## Pattern Overview

**Overall:** TypeScript pnpm monorepo with a Next.js frontend, independent Fastify services, shared DTO package, and a single Drizzle-owned database package.

**Key Characteristics:**
- `apps/web` owns the browser UI and calls service APIs directly.
- `services/*` are independent Fastify services with separate ports and build/test scripts.
- `packages/db` owns the only Drizzle schema, migrations, and DB client.
- `packages/shared` owns Zod DTOs and is imported directly from `src`.
- Local infrastructure is Docker Compose-based.

## Layers

**Frontend Layer:**
- Purpose: User-facing cloud workspace UI.
- Contains: App Router pages, app shell, workspace UI, API clients, client state.
- Location: `apps/web/src`.
- Depends on: public service URLs, shared UI libraries, TanStack Query, Zustand.
- Used by: browser users.

**Service Route Layer:**
- Purpose: HTTP/WebSocket entry points with Zod validation.
- Contains: route registration files such as `services/auth/src/routes.ts`, `services/workspace/src/routes.ts`, `services/runtime/src/routes.ts`.
- Depends on: service classes and schemas from `@pcp/shared`.
- Used by: web app and other service clients.

**Service Logic Layer:**
- Purpose: Business behavior and orchestration.
- Contains: classes such as `AuthService`, `WorkspaceService`, `RuntimeService`, `AgentOrchestrator`, `MemoryService`, `PublishService`.
- Depends on: `@pcp/db/src/client`, Drizzle schema, external providers, Docker/S3/LLM SDKs.
- Used by: route layer.

**Data Layer:**
- Purpose: Schema, migrations, and database connection.
- Contains: `packages/db/src/schema/*`, `packages/db/src/client.ts`, migrations.
- Depends on: Drizzle ORM and `postgres`.
- Used by: all services.

**Shared Contract Layer:**
- Purpose: Request/response schemas and DTO types.
- Contains: `packages/shared/src/*.ts`.
- Depends on: Zod.
- Used by: services and frontend-adjacent code.

**Infrastructure Layer:**
- Purpose: Local Postgres/Redis/MinIO/Traefik/Mailhog.
- Contains: `infra/docker/docker-compose.yml`, `infra/docker/postgres/init.sql`.
- Used by: local development and deployment reference.

## Data Flow

**Authenticated API Request:**
1. Browser calls a service using an axios client in `apps/web/src/lib/api.ts`.
2. Fastify route validates input with a Zod schema from `@pcp/shared`.
3. Route reads `sessionId` cookie and calls a local validation helper.
4. Service logic queries `sessions` and `users` through Drizzle.
5. Service logic performs tenant-scoped reads/writes where implemented.
6. Route returns a JSON response.

**Workspace File Operation:**
1. Browser calls workspace service `/api/workspaces/:id/files`.
2. `WorkspaceService` validates ownership and path safety.
3. Metadata is stored in `workspace_files`.
4. File bytes are stored through S3/MinIO using tenant/workspace-derived keys.

**Runtime Command Execution:**
1. Browser or API client creates a runtime for a workspace.
2. `RuntimeService` creates a Docker container through `DockerProvider`.
3. Commands are filtered, executed through Docker exec, and written to `runtime_logs`/`runtime_events`.
4. Terminal streaming attaches container IO to a WebSocket.

**Agent Task Execution:**
1. Browser creates an agent task through `services/agent`.
2. `AgentOrchestrator` stores a task and starts an async ReAct-style loop.
3. LLM provider returns content and tool calls.
4. Tool calls are executed through local tool classes and logged in `tool_calls`/`task_steps`.
5. Task status moves toward completed, failed, cancelled, or waiting approval.

## State Management

**Persistent State:**
- PostgreSQL stores users, sessions, workspaces, file metadata, runtimes, agent tasks, memory, hosting, settings, snapshots, integrations, and notifications.

**Object State:**
- MinIO/S3 stores file contents and snapshot artifacts.

**Queue State:**
- Redis/BullMQ stores automation jobs.

**Client State:**
- Zustand stores current workspace/editor state.
- TanStack Query manages async frontend server state.

## Key Abstractions

**Fastify Service:**
- Pattern: `index.ts` creates server, registers shared plugins, health route, and feature routes.
- Examples: `services/auth/src/index.ts`, `services/workspace/src/index.ts`.

**Service Class:**
- Pattern: class encapsulates business logic and DB/provider access.
- Examples: `AuthService`, `WorkspaceService`, `RuntimeService`, `MemoryService`, `PublishService`.

**RuntimeProvider:**
- Purpose: Abstract runtime backend so Docker can be replaced later.
- Examples: `services/runtime/src/provider/types.ts`, `services/runtime/src/provider/docker.ts`.

**LLMProvider:**
- Purpose: Abstract chat provider implementations.
- Examples: `services/agent/src/llm/types.ts`, `services/agent/src/llm/provider.ts`.

**Tool Registry:**
- Purpose: Register and dispatch agent tools.
- Examples: `services/agent/src/tools/registry.ts`, `read_file.ts`, `write_file.ts`, `run_command.ts`.

## Entry Points

**Frontend:**
- `apps/web/src/app/layout.tsx` - Root layout.
- `apps/web/src/app/(main)/layout.tsx` - Authenticated app shell.
- `apps/web/src/proxy.ts` - Next proxy/middleware surface.

**Services:**
- `services/auth/src/index.ts` - Port 3001.
- `services/workspace/src/index.ts` - Port 3002.
- `services/runtime/src/index.ts` - Port 3003.
- `services/agent/src/index.ts` - Port 3004.
- `services/memory/src/index.ts` - Memory service.
- `services/publish/src/index.ts` - Port 3006.

**Database:**
- `packages/db/drizzle.config.ts` - Drizzle Kit config.
- `packages/db/src/client.ts` - Drizzle runtime client.
- `packages/db/src/schema/index.ts` - Schema barrel.

## Error Handling

**Strategy:**
- Current implementation mostly throws standard `Error` instances from service classes and sends ad hoc `{ error }` responses from routes.
- `WorkspaceService` has a `WorkspaceError` pattern for status-aware file errors.

**Patterns:**
- Route handlers often short-circuit with `reply.code(401).send({ error: 'Unauthorized' } as any)`.
- Service logic logs some provider failures but not consistently.
- Repo rules call for custom error classes, consistent response envelopes, correlation IDs, and no internal error leakage; this is not yet fully implemented.

## Cross-Cutting Concerns

**Authentication:**
- Cookie session validation is duplicated across services using direct DB reads.

**Authorization/Tenant Isolation:**
- Service methods generally accept `userId` and resource IDs, but coverage is uneven and should be audited before production.

**Validation:**
- Zod validates route inputs through `fastify-type-provider-zod`.
- Some route params still use casts such as `as any`.

**Logging:**
- Pino is configured per service.
- Required pino fields from repo rules are not consistently attached.

**Configuration:**
- Mixed: some startup paths validate env with Zod, while several services use fallback dummy/default secrets.

---
*Architecture analysis: 2026-04-27*
*Update when major patterns change*
