# CloudMind OS — Personal AI Cloud Computer

## What This Is

CloudMind OS is a **multi-tenant, browser-based personal AI cloud computer**. Users get persistent workspaces, file management, an AI agent with tool calling, browser terminal access, automation scheduling, app hosting, snapshots, settings, and admin surfaces through a Next.js frontend backed by independent Fastify services.

## Core Value

Users can safely run and automate useful work inside persistent cloud workspaces without leaking tenant data, credentials, or host resources.

## Context

This is a **brownfield TypeScript pnpm monorepo**. The major product modules already exist, but the implementation still needs production-readiness work around security hardening, tenant isolation, runtime sandboxing, agent durability, test coverage, and deployment reliability.

### Constraints

- **Runtime**: Node.js 20+ and pnpm 9+ required.
- **Database**: PostgreSQL with pgvector required; memory service depends on vector support.
- **Architecture**: No cross-service DB ownership changes; schema and migrations stay in `packages/db`.
- **Frontend**: Next.js 16 and React 19 differ from older conventions.
- **Security**: Every resource query and storage path must be tenant scoped by user/workspace/organization context.
- **Sandbox**: Docker is the MVP runtime boundary; production-readiness work must reduce host escape and resource exhaustion risk before enabling untrusted execution broadly.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16.2.4, React 19.2.4, Tailwind CSS 4, shadcn/ui |
| API Services | Fastify 4.26.x, `fastify-type-provider-zod` |
| ORM | Drizzle ORM 0.45.x |
| Database | PostgreSQL 16 + pgvector |
| Cache/Queue | Redis 7, BullMQ + ioredis |
| Storage | MinIO (S3-compatible) |
| Reverse Proxy | Traefik 3 |
| LLM | OpenAI SDK, Anthropic SDK (incl. MiniMax) |
| Testing | Vitest |
| Package Manager | pnpm 9 |

## Services

| Service | Port | Responsibility |
|---------|------|---------------|
| `apps/web` | 3000 | Next.js frontend — App Router, authenticated shell |
| `services/auth` | 3001 | Auth, sessions, OAuth |
| `services/workspace` | 3002 | File management, workspace CRUD |
| `services/runtime` | 3003 | Docker runtime for sandboxed execution |
| `services/agent` | 3004 | AI agent, task orchestration, tool calling, automations |
| `services/memory` | 3005 | Vector memory, embeddings (pgvector) |
| `services/publish` | 3006 | App hosting, deployment |
| `services/browser` | 3007 | Headless browser automation |

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Independent services over monolith | Isolation, independent deploy, per-service scaling | Working well — 7 services running independently |
| pnpm workspace | Unified dependency management, shared packages (`@pcp/db`, `@pcp/shared`) | Working well |
| Drizzle ORM over Prisma | SQL-first, lightweight, no schema DSL lock-in | Working well |
| Docker for runtime sandboxing | MVP boundary, easy to reason about | Needs hardening for untrusted code |
| SSE for agent task streaming | Simple push for live task updates | Working well |
| BYOK for LLM credentials | Users bring their own API keys | Implemented with AES-256-GCM encryption |

## Requirements

### Validated

- ✓ Multi-tenant user auth (email/password + OAuth)
- ✓ Persistent workspaces with file storage (MinIO)
- ✓ AI agent with tool calling (15 tools, parallel execution)
- ✓ Agent task lifecycle (pending → executing → completed/failed/cancelled)
- ✓ Tool approval flow for destructive operations
- ✓ Multi-LLM provider support (OpenAI, Anthropic, MiniMax)
- ✓ BYOK credential encryption
- ✓ Automation scheduling (BullMQ + cron)
- ✓ Webhook triggers for automations
- ✓ Browser automation (open, extract, screenshot, click, fill)
- ✓ Vector memory with pgvector
- ✓ Telegram channel integration
- ✓ Persona and skill system
- ✓ Audit logging
- ✓ Runtime sandbox hardening (seccomp, cgroups, network isolation, health checks)
- ✓ Rate limiting per user on agent endpoints
- ✓ Token usage tracking and limits
- ✓ Cross-service authentication (shared session validation)
- ✓ Admin dashboard surfaces (users, audit logs, runtime events, health)
- ✓ Dataset query tool expansion (list_datasets, describe_dataset, query_dataset)
- ✓ Parallel multi-tool execution in single LLM response (Promise.all)
- ✓ Automation worker waits for real task completion (polling loop)
- ✓ All tests passing (204 total across 7 services)
- ✓ Full monorepo typecheck clean (10 packages)
- ✓ Snapshot system complete (create, list, restore, delete, download, storage usage)
- ✓ Snapshot timeline UI with day grouping and storage indicator

### Active

- [ ] Frontend notification system polish

### Out of Scope

- Mobile native apps — browser PWA is the target
- Multi-region deployment — single-region MVP
- GPU acceleration for local models — cloud API only
- Real-time collaborative editing — single-user workspace focus

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-30 after GSD initialization*
