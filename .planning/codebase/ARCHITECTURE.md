# Architecture

*Last mapped: 2026-04-27*

## Pattern Overview
Browser-based multi-tenant SaaS:
- `apps/web` — Next.js 16 / React 19 frontend; calls each service directly (no central API gateway, despite stale README hints).
- `services/*` — six independent Fastify services on dedicated ports; each owns its domain.
- `packages/db` — single owner of Drizzle schema, migrations, and DB client.
- `packages/shared` — pure-TS Zod DTOs imported directly from source.
- `infra/docker/` — local Compose stack (Postgres+pgvector, Redis, MinIO, Traefik, Mailhog).

## Layers (within a service)
Per `.cursor/rules/architecture.mdc`:

1. **Route layer** — `services/<svc>/src/routes.ts` (or `routes/<feature>.ts`).
   - Fastify routes, Zod request/response schemas via `fastify-type-provider-zod`.
   - Owns HTTP and validation only.
2. **Service layer** — `services/<svc>/src/service.ts`.
   - Class encapsulating business logic and provider/DB access.
   - Examples: `AuthService`, `WorkspaceService`, `RuntimeService`, `AgentOrchestrator`, `MemoryService`, `PublishService`.
3. **Repository layer** — *target* layer (per rules); DB-only operations.
   - **Reality:** services currently embed Drizzle queries inline; an explicit repository module is not yet split out. Tracked in CONCERNS.md.
4. **Schema/DTOs** — `@pcp/shared/src/<domain>.ts` (Zod) consumed by routes and frontend.
5. **DB client** — `packages/db/src/client.ts` — single Drizzle client; services import directly from `@pcp/db/src/...`.

## Frontend Layers
- `apps/web/src/app/layout.tsx` — root layout.
- `apps/web/src/app/(main)/layout.tsx` — authenticated app shell.
- `apps/web/src/app/(main)/<feature>/...` — App-Router pages per module.
- `apps/web/src/components/<feature>/...` — feature components.
- `apps/web/src/components/ui/...` — shadcn primitives.
- `apps/web/src/store/workspace.ts` — Zustand state.
- `apps/web/src/hooks/...` — TanStack Query hooks per service.
- `apps/web/src/lib/...` — service URL config, API clients, helpers.
- `apps/web/src/proxy.ts` — Next proxy/middleware surface.

## Data Flow

```
Browser (apps/web)
  │
  │  HTTPS (Traefik in prod / direct in dev)
  ▼
┌──────────┬────────────┬─────────┬────────┬─────────┬─────────┐
│ auth     │ workspace  │ runtime │ agent  │ memory  │ publish │
│ :3001    │ :3002      │ :3003   │ :3004  │ :3005   │ :3006   │
└─────┬────┴──────┬─────┴────┬────┴───┬────┴────┬────┴────┬────┘
      │           │          │        │         │         │
      ▼           ▼          ▼        ▼         ▼         ▼
   Postgres    Postgres    Docker   Postgres  Postgres  Docker
   (sessions) (workspace +(PTY,    (tasks,   (pgvector  (hosted
              S3 metadata) exec)   tools)    memory)    apps)
                  │           │       │         │         │
                  ▼           ▼       ▼         ▼         ▼
                 MinIO    Docker    Redis    OpenAI/   Traefik
                          socket   (BullMQ)  Anthropic (routes)
```

- Web terminal: `apps/web` ↔ WebSocket ↔ `services/runtime` ↔ Docker exec PTY.
- Streaming chat: `apps/web` ↔ `services/agent` ↔ provider SDK; tool-call approval round-trips through DB-tracked `agent_task_steps`.
- Automations: scheduled jobs in BullMQ → agent service worker → orchestrator → tools.

## State Management
- **Postgres** — users, sessions, workspaces, file metadata, runtimes, agent tasks, memory, hosting, settings, snapshots, integrations, notifications, audit logs.
- **MinIO/S3** — file contents and snapshot tarballs.
- **Redis / BullMQ** — automation jobs.
- **Zustand** — current workspace + editor state in browser.
- **TanStack Query** — async server state in browser.

## Key Abstractions
| Abstraction         | Where                                                                  | Purpose                                       |
|---------------------|------------------------------------------------------------------------|-----------------------------------------------|
| Service entry       | `services/<svc>/src/index.ts`                                          | Build Fastify, register plugins, mount routes |
| Service class       | `services/<svc>/src/service.ts`                                        | Domain logic + persistence                    |
| `RuntimeProvider`   | `services/runtime/src/provider/types.ts` + `docker.ts`                 | Swap Docker for microVMs later (ADR-003)      |
| `LLMProvider`       | `services/agent/src/llm/types.ts` + `provider.ts`                      | Multiple chat providers (OpenAI/Anthropic)    |
| Tool registry       | `services/agent/src/tools/registry.ts` + `<tool>.ts` files             | MCP-compatible agent tools (ADR-005)          |
| Embedding provider  | `services/memory/src/embeddings/`                                      | Abstract OpenAI embeddings                    |
| Workspace error     | `services/workspace/src/...` (`WorkspaceError`)                        | HTTP-status-aware errors                      |
| `assertSafePath()`  | path-traversal guard used across file operations                       | Block `..`, null bytes, `~`                   |

## Entry Points
- Frontend: `apps/web/src/app/layout.tsx`, `apps/web/src/app/(main)/layout.tsx`, `apps/web/src/proxy.ts`.
- Auth `:3001` — `services/auth/src/index.ts`.
- Workspace `:3002` — `services/workspace/src/index.ts`.
- Runtime `:3003` — `services/runtime/src/index.ts`.
- Agent `:3004` — `services/agent/src/index.ts`.
- Memory `:3005` — `services/memory/src/index.ts`.
- Publish `:3006` — `services/publish/src/index.ts`.
- DB tooling — `packages/db/drizzle.config.ts`.

## Cross-Cutting Concerns
- **Tenant isolation** — every DB query filters by `user_id`/`organization_id`; storage paths are tenant-prefixed.
- **Logging** — Pino JSON via Fastify; required fields: `correlationId`, `userId`, `service`. No PII.
- **Validation** — Zod at HTTP edges; env should be Zod-validated at startup (uneven adoption).
- **Rate limiting** — `@fastify/rate-limit` on every service; tighter limits on auth login/register.
- **Encryption** — AES-256-GCM with random IV per stored API key; plaintext never logged.
