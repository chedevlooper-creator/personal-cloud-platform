# Architecture

> Derived from: graphify-out/GRAPH_REPORT.md, AGENTS.md, README.md, file tree.
> Last updated: 2026-05-06

## Shape

pnpm monorepo. **One Next.js frontend + 7 independent Fastify v4 microservices**, glued by Postgres (pgvector), Redis (BullMQ), MinIO (S3), Traefik. No `apps/api` (README's stale claim).

```
personal-cloud-platform/
├── apps/web/                  Next.js 16 + React 19 frontend (24 routed pages)
├── services/
│   ├── auth/        :3001    Email/password + OAuth, session cookies, Supabase JWT bridge
│   ├── workspace/   :3002    Files, snapshots, datasets, terminal sessions
│   ├── runtime/     :3003    Docker container runtime, command policy
│   ├── agent/       :3004    AI orchestrator, tool calls, automations, MCP, channels
│   ├── memory/      :3005    pgvector-backed memory entries
│   ├── publish/     :3006    Hosted services (deploy static/Vite/Node via Traefik)
│   └── browser/     :3007    Cloud Playwright sessions
├── packages/
│   ├── db/          @pcp/db        Drizzle ORM, 24 schema tables, migrations, seed
│   └── shared/      @pcp/shared    Pure TS, no build (consumers import from src/)
├── infra/docker/                  docker-compose: pgvector pg16, redis 7, minio, traefik 3, mailhog
├── design-system/                 Master design tokens + page specs
├── docs/                          PRD, decisions, context7 mirrors, superpowers reports
└── scripts/                       baseline-smoke.mjs, ops scripts
```

## Service Topology (cross-cutting)

```
                ┌────────────┐
                │  apps/web  │  Next.js, calls services via HTTP
                └──────┬─────┘
        ┌──────────────┼──────────────────────────────┐
        ▼              ▼                              ▼
  ┌──────────┐   ┌──────────────┐               ┌──────────┐
  │   auth   │   │   workspace  │ ──snapshots──▶│  MinIO   │
  └────┬─────┘   └──┬───────────┘               └──────────┘
       │            │  ┌─────────────┐
       │            └─▶│   runtime   │ docker exec, command policy
       │               └──────┬──────┘
       │                      │
       ▼                      ▼
  ┌──────────────────────────────┐  ┌──────────┐  ┌──────────┐
  │      Postgres (pgvector)     │  │  agent   │──│  memory  │
  │   24 tables, tenant_id every │  │ BullMQ   │  │ pgvector │
  └──────────────────────────────┘  └────┬─────┘  └──────────┘
                                         │  ┌──────────┐
                                         ├─▶│ publish  │ deploy via Traefik
                                         │  └──────────┘
                                         │  ┌──────────┐
                                         └─▶│ browser  │ Playwright sessions
                                            └──────────┘
```

**Inter-service comms:** HTTP (internal service token + `X-User-Id` header) and Redis pub-sub / BullMQ queues. **No cross-service DB access** — every service owns its data via `@pcp/db` schemas.

## Per-Service Layering (consistent rule)

Each service follows: `route` (Fastify + Zod validation) → `service` (business logic) → `repository` (only DB calls). DTOs live in `@pcp/shared`. Logging is pino JSON with `correlationId, userId, service`; no PII.

**Audit gap:** `services/auth/src/routes/profile.ts`, `services/auth/src/routes/admin.ts`, and `services/agent/src/routes/automation.ts` still do direct DB work — layering violation.

## Data Model (24 tables, all tenant-scoped)

- **Identity:** `users`, `sessions`, `oauth_accounts`, `provider_credentials`
- **Workspace:** `workspaces`, `workspace_files`, `snapshots`, `datasets`, `terminal`
- **Runtime:** `runtimes`, `runtime_events`, `runtime_logs`, `hosted_services`
- **Agent:** `conversations`, `tasks`, `task_steps`, `tool_calls`, `automations`, `skills`, `channel_links`, `notifications`
- **Memory:** `memory_entries` (pgvector embeddings)
- **Audit:** `audit_logs`

Every query MUST filter by `user_id` or `organization_id`. Storage paths in MinIO are tenant-prefixed.

**Audit gap:** Tenant isolation is application-enforced only — no Postgres RLS. A missed filter leaks data with no DB backstop.

## Frontend Surface (24 pages)

Auth group: `login`, `register`.
Main group: `dashboard`, `workspaces`, `workspace/[id]`, `chats`, `files`, `terminal`, `automations`, `hosting`, `snapshots`, `datasets`, `browser`, `channels`, `settings`, `personas`, `skills`, `rules`, `bookmarks`, `audit-log`, `admin`, `apps`, `space`, `computer`.

UI text is **Turkish** (e.g. "Sohbet", "Chat'e ekle"). App Router + Tailwind v4 + shadcn/ui. Cross-component coordination uses custom DOM events: `app:attach-file-to-chat`, `app:apply-code-to-workspace`.

**Audit gap:** Some custom-event flows have no reliable consumer (`MainCanvas` ↔ `KeyboardShortcutProvider` toggle loop risk).

## God Nodes (graphify, top 10 by edge count)

1. `cn()` — utility, 41 edges (expected, not a defect)
2. `AgentOrchestrator` — 38 edges (real hub: tools, memory, channels)
3. `WorkspaceService` — 37 edges (files, snapshots, datasets)
4. `Zihinbulut Master Design System` — 32 edges (design tokens reach every page)
5. `users table` — 30 edges (root of tenant model)
6. `toastApiError()` — 22 edges (only error sink; uniform-but-shallow)
7. `RuntimeService` — 22 edges
8. `@pcp/shared barrel export` — 21 edges
9. `db schema barrel` — 20 edges

Implication: `AgentOrchestrator` and `WorkspaceService` are change-amplifiers — touch with care. Design system tokens are the single largest UI dependency.

## Build Order Implications

- `@pcp/db` and `@pcp/shared` are leaves (no service deps); change first when DTOs/schema move.
- Services are independent; can be developed/deployed in isolation.
- `apps/web` consumes all 7 services; UI changes don't ripple back.
