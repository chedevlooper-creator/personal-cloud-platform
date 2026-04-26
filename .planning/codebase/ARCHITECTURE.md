# Architecture

Last mapped: 2026-04-27

## Pattern

**Microservices monorepo** — 6 independent Fastify services + 1 Next.js frontend, sharing database schema and DTOs via internal packages.

## System Overview

```
┌─────────────────────────────────────────────────────┐
│                  apps/web (Next.js 16)              │
│              React 19 + Tailwind v4 + shadcn        │
│            Port 3000 — Frontend SPA                 │
└──────────────┬──────────────────────────────────────┘
               │ HTTP (axios)
    ┌──────────┴──────────────────────────────────────┐
    │                Backend Services                  │
    │                                                  │
    │  ┌─────────┐  ┌───────────┐  ┌──────────┐      │
    │  │  auth   │  │ workspace │  │ runtime  │      │
    │  │  :3001  │  │   :3002   │  │  :3003   │      │
    │  └────┬────┘  └─────┬─────┘  └────┬─────┘      │
    │       │             │             │              │
    │  ┌────┴────┐  ┌─────┴─────┐  ┌───┴───────┐    │
    │  │  agent  │  │  memory   │  │  publish  │    │
    │  │  :3004  │  │   :3005   │  │   :3006   │    │
    │  └─────────┘  └───────────┘  └───────────┘    │
    └──────────────────────┬───────────────────────────┘
                           │
    ┌──────────────────────┴───────────────────────────┐
    │              Shared Packages                     │
    │  ┌─────────────┐    ┌──────────────────┐        │
    │  │  @pcp/db    │    │   @pcp/shared    │        │
    │  │ (schema,    │    │ (DTOs, Zod       │        │
    │  │  client,    │    │  schemas, types) │        │
    │  │  migrations)│    │ no build step    │        │
    │  └──────┬──────┘    └──────────────────┘        │
    └─────────┼────────────────────────────────────────┘
              │
    ┌─────────┴────────────────────────────────────────┐
    │              Infrastructure (Docker)              │
    │  PostgreSQL (pgvector) · Redis · MinIO · Traefik │
    │  Mailhog                                         │
    └──────────────────────────────────────────────────┘
```

## Service Layering

Each backend service follows a 3-layer pattern:

```
route (HTTP + Zod validation)
  └── service (business logic)
        └── repository (DB access via @pcp/db)
```

**Current state**: most services combine service + repository into a single class (e.g. `AuthService`, `WorkspaceService`). The repository layer is implicit — DB queries are made directly via Drizzle inside service classes.

## Data Flow

### Authentication Flow
1. Client → `POST /auth/login` → auth service
2. Auth service validates credentials (argon2)
3. Creates session row in DB
4. Returns session ID as HTTP-only cookie
5. All other services validate session by querying `sessions` table directly

### Workspace File Flow
1. Client → workspace service
2. Metadata in PostgreSQL (`workspace_files` table)
3. File content in MinIO/S3 (`{userId}/{workspaceId}/{path}`)
4. Storage quota tracked on `workspaces.storageUsed`

### Agent Task Flow
1. Client → `POST /agent/tasks` → agent service
2. Orchestrator creates task record → fires async `runAgentLoop`
3. Loop: LLM generate → tool call (if any) → tool execute → observation → repeat
4. Each step persisted to `task_steps` table
5. Max 15 iterations, then fails

### Memory Flow
1. Client → memory service → generates embedding via OpenAI
2. Stores in `memory_entries` with pgvector column
3. Search: query → embed → cosine similarity (`<->` operator) → top-k results

### Publish Flow
1. Client → publish service → creates `published_apps` record
2. Deploy: creates `nginx:alpine` container with Traefik labels
3. Traefik routes `{subdomain}.apps.platform.com` to container

## Entry Points

| Service   | Entry File                       |
|-----------|----------------------------------|
| auth      | `services/auth/src/index.ts`     |
| workspace | `services/workspace/src/index.ts`|
| runtime   | `services/runtime/src/index.ts`  |
| agent     | `services/agent/src/index.ts`    |
| memory    | `services/memory/src/index.ts`   |
| publish   | `services/publish/src/index.ts`  |
| web       | `apps/web/src/app/layout.tsx`    |

## Key Abstractions

### LLMProvider (`services/agent/src/llm/types.ts`)
Interface for LLM adapters. Implementations: `AnthropicProvider`, `OpenAIProvider`. Factory: `createLLMProvider()`.

### RuntimeProvider (`services/runtime/src/provider/types.ts`)
Interface for sandbox backends. Implementation: `DockerProvider`. Planned: Firecracker, Kata.

### ToolRegistry (`services/agent/src/tools/registry.ts`)
Manages tool registration and execution. Currently one tool: `ReadFileTool`.

### WorkspaceObjectStorage (`services/workspace/src/service.ts`)
Interface for file content storage. Implementation: `S3WorkspaceObjectStorage`.

### EmbeddingProvider (`services/memory/src/embeddings/types.ts`)
Interface for embedding generation. Implementation: `OpenAIEmbeddingProvider`.

## Multi-Tenancy

- Every query scoped by `userId` (no organization support yet)
- Storage paths tenant-prefixed: `{userId}/{workspaceId}/...`
- Session validation duplicated across services (each service queries DB directly)
- Soft delete via `deletedAt` column on workspaces and files

## Cross-Service Communication

- **Current**: No inter-service HTTP or messaging — services are independent
- **Planned**: Redis pub/sub, BullMQ (per architecture rules)
- **Shared data**: All services access same PostgreSQL instance via `@pcp/db`
