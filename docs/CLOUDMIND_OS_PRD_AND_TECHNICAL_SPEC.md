# CloudMind OS — PRD & Technical Specification

**Version:** 0.1.0-beta  
**Last Updated:** 2026-05-01  
**Status:** Development / Beta  
**Audience:** Engineering Team, DevOps, Technical Leads

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [System Architecture](#3-system-architecture)
4. [Service Specifications](#4-service-specifications)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Data Model](#6-data-model)
7. [Infrastructure](#7-infrastructure)
8. [Security Architecture](#8-security-architecture)
9. [Development Workflow](#9-development-workflow)
10. [API Reference](#10-api-reference)
11. [Testing Strategy](#11-testing-strategy)
12. [Production Deployment](#12-production-deployment)
13. [Roadmap & Issues](#13-roadmap--issues)

---

## 1. Executive Summary

CloudMind OS is a multi-tenant, browser-based "personal AI cloud computer" platform. Users get persistent cloud workspaces, an AI agent with tool-calling, a web terminal, file management, automation scheduling, app hosting, snapshots, and admin surfaces.

**Architecture:** pnpm monorepo with Next.js 16 frontend and 7 independent Fastify v4 microservices, backed by PostgreSQL (pgvector), Redis, MinIO, and Docker.

### Current Status

| Dimension | Status |
|-----------|--------|
| **Services** | 7/7 operational (ports 3001-3007) |
| **Frontend** | Next.js 16 + React 19, 25+ pages |
| **Tests** | 232 tests, all passing |
| **TypeScript** | Strict mode, 10/10 packages pass typecheck |
| **Build** | All packages compile successfully |
| **Readiness** | Beta — production hardening required |

### Core Value Proposition

Users can safely run and automate useful work inside persistent cloud workspaces without leaking tenant data, credentials, or host resources.

---

## 2. Product Overview

### 2.1 Vision

Build a personal AI cloud computer where every user gets a dedicated, persistent, and secure workspace in the cloud. The AI agent acts as an operating system layer — managing files, running code, browsing the web, and deploying applications on behalf of the user.

### 2.2 Feature Modules

| Module | Description | Status |
|--------|-------------|--------|
| **Auth** | Email/password + Google OAuth, Argon2id, session cookies, rate limiting | Shipped |
| **Dashboard** | Quick-action cards, workspace summary, recent activity | Shipped |
| **Files** | S3-backed file tree, Monaco editor, drag-drop upload, preview | Shipped |
| **AI Chat** | Streaming responses, tool-call approval UI, multi-provider BYOK | Shipped |
| **Terminal** | xterm.js + WebSocket PTY, configurable security policy | Shipped |
| **Automations** | BullMQ-scheduled AI tasks (manual/hourly/daily/weekly/cron) | Shipped |
| **Hosting** | Deploy static sites, Vite apps, or Node APIs via Docker + Traefik | Shipped |
| **Snapshots** | Workspace tar.gz backup to S3, one-click restore | Shipped |
| **Datasets** | DuckDB-backed CSV/JSON/Parquet import, read-only SQL playground | Shipped |
| **Browser** | Cloud Playwright sessions per user, agent tool integration | Shipped |
| **Channels** | Telegram bot adapter (webhook in, agent out) | Shipped |
| **Settings** | AES-256-GCM encrypted API keys, theme, terminal policy | Shipped |
| **Audit Log** | Per-user history of privileged actions, retention pruner | Shipped |
| **Admin** | User list, audit logs, system health dashboard | Shipped |

### 2.3 User Personas

1. **Developer User** — Uses workspace for coding, terminal for commands, agent for automation
2. **Data Analyst** — Imports datasets, runs SQL queries, generates reports via agent
3. **No-Code Builder** — Deploys web apps via hosting, manages via dashboard
4. **Admin** — Monitors users, reviews audit logs, manages system health

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
Internet
    |
Traefik (HTTPS, :80/:443)
    |
    +-- Next.js Frontend (:3000)
    |
    +-- Auth Service (:3001)
    +-- Workspace Service (:3002)
    +-- Runtime Service (:3003)
    +-- Agent Service (:3004)
    +-- Memory Service (:3005)
    +-- Publish Service (:3006)
    +-- Browser Service (:3007)
    |
    +-- PostgreSQL 16 (pgvector)
    +-- Redis 7 (BullMQ)
    +-- MinIO (S3-compatible)
    +-- Docker Engine (sandbox)
```

### 3.2 Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | Next.js, React, Tailwind CSS v4, shadcn/ui | 16.2.4, 19.2.4 |
| **Backend** | Fastify, fastify-type-provider-zod, Drizzle ORM | 4.26.x, 0.45.x |
| **Database** | PostgreSQL (pgvector), Drizzle ORM | 16 |
| **Queue** | BullMQ, ioredis | — |
| **Storage** | MinIO (S3-compatible) | — |
| **Runtime** | Docker, Dockerode | — |
| **Proxy** | Traefik | 3.x |
| **AI/LLM** | OpenAI SDK, Anthropic SDK, MiniMax | — |
| **Testing** | Vitest | auth/workspace: ^4.1.5, others: ^1.4.0 |
| **Build** | TypeScript, tsc, next build | 5.4.x |

### 3.3 Monorepo Structure

```
personal-cloud-platform/
├── apps/
│   └── web/                    # Next.js 16 frontend
├── services/
│   ├── auth/                   # Auth service (:3001)
│   ├── workspace/              # File/workspace service (:3002)
│   ├── runtime/                # Terminal/runtime service (:3003)
│   ├── agent/                  # AI agent service (:3004)
│   ├── memory/                 # Vector memory service (:3005)
│   ├── publish/                # Hosting service (:3006)
│   └── browser/                # Browser automation service (:3007)
├── packages/
│   ├── db/                     # Drizzle schema + migrations
│   └── shared/                 # Zod DTOs (no build step)
├── infra/
│   └── docker/                 # docker-compose.yml, .env.example
├── scripts/                    # Backup, restore, prune utilities
└── docs/                       # Documentation
```

### 3.4 Communication Patterns

| Pattern | Used By | Protocol |
|---------|---------|----------|
| Frontend to Services | All | HTTP REST + Cookies |
| Terminal | Runtime | WebSocket |
| Task Events | Agent | SSE (Server-Sent Events) |
| Service to Service | Agent to Workspace/Runtime/Memory/Browser | HTTP + Bearer Token |
| Async Jobs | Agent | BullMQ + Redis |

### 3.5 Layering Convention

Every backend service follows:

```
Route (HTTP + Zod validation)
    |
Service (business logic + orchestration)
    |
DB Access (Drizzle ORM)
```

**Note:** Current codebase embeds DB access directly in Service classes. Explicit Repository layer is the target convention.

---

## 4. Service Specifications

### 4.1 Auth Service (`@pcp/auth-service`)

**Port:** 3001 | **Entry:** `services/auth/src/index.ts` | **Prefix:** `/auth`

#### Responsibilities
- User registration and login (email/password with Argon2id)
- Session management (HTTP-only, SameSite=Lax cookies)
- Google OAuth 2.1 with PKCE
- Provider credential management (BYOK)
- Audit logging for privileged actions
- Admin user gating

#### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account, start session |
| POST | `/auth/login` | Credential login |
| POST | `/auth/logout` | Destroy session |
| GET | `/auth/me` | Current user |
| GET | `/auth/oauth/google/start` | OAuth initiation |
| GET | `/auth/oauth/google/callback` | OAuth callback |
| GET | `/admin/users` | Admin: list users |
| GET | `/admin/audit-logs` | Admin: audit history |

#### Environment

```
DATABASE_URL          # Required
COOKIE_SECRET         # Required (>= 32 bytes)
ENCRYPTION_KEY        # Required (exactly 32 bytes)
GOOGLE_CLIENT_ID      # Optional
GOOGLE_CLIENT_SECRET  # Optional
ADMIN_EMAIL           # Optional (gates admin routes)
```

#### Security
- Argon2id password hashing
- Rate limiting: 5 req/min on login/register
- AES-256-GCM for provider API keys
- Session cookies: secure in production, httpOnly, sameSite: lax

---

### 4.2 Workspace Service (`@pcp/workspace-service`)

**Port:** 3002 | **Entry:** `services/workspace/src/index.ts` | **Prefix:** `/api`

#### Responsibilities
- Workspace CRUD (auto-provisions default workspace)
- File management (S3-backed with tenant-prefixed paths)
- Directory operations
- Snapshot creation and restoration
- Dataset import and querying (DuckDB)
- Storage quota tracking

#### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/workspaces` | Create workspace |
| GET | `/api/workspaces` | List user workspaces |
| GET | `/api/workspaces/:id` | Get workspace |
| DELETE | `/api/workspaces/:id` | Soft delete |
| GET | `/api/workspaces/:id/files` | List files |
| GET | `/api/workspaces/:id/files/content` | Read file content |
| POST | `/api/workspaces/:id/files/write` | Write text file |
| POST | `/api/workspaces/:id/upload` | Upload file (multipart) |
| DELETE | `/api/workspaces/:id/files/*` | Delete file |
| POST | `/api/workspaces/:id/files/move` | Move/rename |
| GET | `/api/workspaces/:id/sync/manifest` | Runtime sync manifest |

#### File Path Security

```typescript
private assertSafePath(path: string): void {
  const normalized = path.replace(/\\/g, '/');
  if (normalized.includes('..') || normalized.includes('\0') || normalized.startsWith('~')) {
    throw new WorkspaceError('Path traversal detected — access denied', 403);
  }
}
```

**Known Issue:** assertSafePath only exists in workspace service. Other services lack this protection.

#### S3 Path Convention

```
{userId}/{workspaceId}/{filePath}              # Regular files
snapshots/{userId}/{workspaceId}/{ts}.json.gz  # Snapshots
```

#### DuckDB Dataset Security

User-provided SQL validated via assertReadOnly():
- Banned keywords: INSERT, UPDATE, DELETE, DROP, CREATE, etc.
- File-reading functions blocked via regex
- **Known Issue:** read_parquet and read_json are not in the blocklist

---

### 4.3 Runtime Service (`@pcp/runtime-service`)

**Port:** 3003 | **Entry:** `services/runtime/src/index.ts` | **Prefix:** `/api`

#### Responsibilities
- Per-workspace Docker container lifecycle
- PTY terminal over WebSocket
- Command execution (run_command agent tool)
- Resource limits enforcement (CPU, memory, PIDs)
- Security policy enforcement (seccomp, AppArmor)

#### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/runtimes` | Create runtime |
| POST | `/api/runtimes/ensure` | Idempotent get-or-create |
| POST | `/api/runtimes/:id/start` | Start container |
| POST | `/api/runtimes/:id/stop` | Stop container |
| POST | `/api/runtimes/:id/exec` | Execute command |
| DELETE | `/api/runtimes/:id` | Remove container |
| WS | `/api/runtimes/:id/terminal` | PTY WebSocket |

#### Docker Sandbox Defaults

```yaml
User: '1000:1000'              # Non-root
NetworkMode: 'none'            # No outbound network
ReadonlyRootfs: true           # Read-only root filesystem
CapDrop: ['ALL']               # Drop all capabilities
PidsLimit: 100                 # Fork bomb protection
SecurityOpt: ['no-new-privileges:true']
Tmpfs:
  '/tmp': 'rw,noexec,nosuid,size=100m'
Ulimits:
  - Name: 'nofile'
    Soft: 1024
    Hard: 1024
Memory: 512MB (default, max 4GB)
CPU: 1 core (default, max 4)
```

#### Terminal Security Policy

Commands categorized as:
- safe — allowed immediately
- needs_approval — requires user confirmation
- blocked — refused server-side

Blocked patterns: rm -rf /, sudo, fork bombs

---

### 4.4 Agent Service (`@pcp/agent-service`)

**Port:** 3004 | **Entry:** `services/agent/src/index.ts` | **Prefix:** `/api`

#### Responsibilities
- AI chat and task orchestration
- ReAct loop (Reasoning + Acting) with 15-iteration cap
- Tool registry and dispatch
- BullMQ automation worker
- Persona and skill management
- Channel integrations (Telegram)
- Notification system
- BYOK credential resolution

#### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/agent/chat` | One-shot chat |
| POST | `/api/agent/tasks` | Create task |
| GET | `/api/agent/tasks/:id` | Task detail |
| GET | `/api/agent/tasks/:id/steps` | Step log |
| POST | `/api/agent/tasks/:id/cancel` | Cancel task |
| POST | `/api/agent/tasks/:id/tool-approval` | Approve/reject tool |
| GET | `/api/agent/tasks/:id/events` | SSE for live updates |
| GET/POST | `/api/agent/conversations` | Conversation CRUD |
| GET/POST/PATCH/DELETE | `/api/automations` | Automation CRUD |
| POST | `/api/automations/:id/run` | Manual trigger |
| POST | `/api/automations/:id/trigger` | External trigger (token) |
| GET/POST/PATCH/DELETE | `/api/personas` | Persona CRUD |
| GET/POST/PATCH/DELETE | `/api/skills` | Skill CRUD |
| POST | `/api/skills/match` | Skill suggestion |
| GET/POST/DELETE | `/api/channels/links` | Channel link CRUD |
| POST | `/api/channels/telegram/webhook` | Telegram webhook |

#### ReAct Loop

```
1. createTask(userId, workspaceId, input, metadata)
   → inserts tasks row
2. runAgentLoop(taskId, userId)
   → up to 15 iterations
   → each iteration: build messages → LLM.generate() → handle tool_calls
   → tool approval gating if requiresApproval=true
   → persists task_steps (thought/action/observation)
3. Loop ends: final answer | iteration cap | cancelled | fatal error
```

#### Tool Catalog

| Tool | Approval | Description |
|------|----------|-------------|
| read_file | No | Read workspace file |
| write_file | No | Write workspace file |
| list_files | No | List directory |
| run_command | Yes | Execute shell command in container |
| web_search | No | Search web |
| web_fetch | No | Fetch URL content |
| search_memory | No | Semantic search |
| add_memory | No | Store memory |
| query_dataset | No | DuckDB SQL query |
| browser_open | No | Open browser session |
| browser_click | Yes | Click element |
| browser_fill | Yes | Fill form field |
| browser_screenshot | No | Take screenshot |
| browser_extract | No | Extract page data |

#### BYOK Flow

1. Read user_preferences for defaultProvider and defaultModel
2. Read active provider_credentials row
3. AES-256-GCM decrypt API key with ENCRYPTION_KEY
4. Build env overlay for this request
5. Create isolated LLM provider instance
6. Fallback to service default if any step fails

**Security:** Keys never leak across requests; each task gets its own provider instance.

#### Known Issue: Telegram Webhook

POST /channels/telegram/webhook uses body: z.any() — no Zod validation at Fastify layer. Manual validation is performed but is not equivalent to schema validation.

---

### 4.5 Memory Service (`@pcp/memory-service`)

**Port:** 3005 | **Entry:** `services/memory/src/index.ts` | **Prefix:** `/api`

#### Responsibilities
- Vector memory storage (pgvector)
- Semantic search with OpenAI embeddings
- Local hash fallback for embedding generation
- Memory entry CRUD

#### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/memory/entries` | Create entry |
| POST | `/api/memory/search` | Semantic search |
| GET | `/api/memory/entries` | List entries |
| DELETE | `/api/memory/entries/:id` | Delete entry |

#### Vector Search

Uses pgvector HNSW index for approximate nearest neighbor search. Embeddings via OpenAI text-embedding-3-small (default) or local hash fallback. All queries filter by user_id for tenant isolation.

---

### 4.6 Publish Service (`@pcp/publish-service`)

**Port:** 3006 | **Entry:** `services/publish/src/index.ts` | **Prefix:** `/api`

#### Responsibilities
- Host user applications as Docker containers
- Traefik router/label generation
- Encrypted environment variables (AES-256-GCM)
- Workspace materialization before launch
- Auto-restart for crashed services

#### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/hosted-services` | Create service |
| GET | `/api/hosted-services` | List services |
| GET | `/api/hosted-services/:id` | Detail |
| POST | `/api/hosted-services/:id/start` | Start container |
| POST | `/api/hosted-services/:id/stop` | Stop container |
| PATCH | `/api/hosted-services/:id` | Update |
| DELETE | `/api/hosted-services/:id` | Remove |
| GET | `/api/hosted-services/:id/logs` | Container logs |

#### Encryption

```typescript
// Format: enc:<iv_base64>.<tag_base64>.<ciphertext_base64>
encryptValue(plaintext: string): string
decryptValue(stored: string): string
```

- 12-byte random IV per value
- 16-byte auth tag (GCM)
- 32-byte key from ENCRYPTION_KEY

**Client-facing responses:** All env values redacted to ***

#### Sandbox

Hosted containers use the same hardened profile as runtime containers.

---

### 4.7 Browser Service (`@pcp/browser-service`)

**Port:** 3007 | **Entry:** `services/browser/src/index.ts` | **Prefix:** `/api`

#### Responsibilities
- Cloud Playwright browser sessions per user
- Agent tool integration (browser_* tools)
- Session lifecycle management (idle timeout reaping)
- Tenant isolation (per-user contexts)

#### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/browser/sessions` | Create session |
| GET | `/api/browser/sessions` | List sessions |
| GET | `/api/browser/sessions/:id` | Session detail |
| POST | `/api/browser/sessions/:id/navigate` | Navigate to URL |
| POST | `/api/browser/sessions/:id/click` | Click element |
| POST | `/api/browser/sessions/:id/fill` | Fill form |
| POST | `/api/browser/sessions/:id/screenshot` | Screenshot (PNG) |
| POST | `/api/browser/sessions/:id/extract` | Extract page data |
| DELETE | `/api/browser/sessions/:id` | Close session |

#### Session Isolation

Each session is created inside a per-user Playwright context. Cookies and storage do not leak between users. Idle sessions reaped on a timer (BROWSER_SESSION_TTL_MS).

---

## 5. Frontend Architecture

### 5.1 Technology Stack

| Technology | Purpose |
|------------|---------|
| Next.js 16.2.4 | Framework (App Router) |
| React 19.2.4 | UI library |
| Tailwind CSS v4 | Styling |
| shadcn/ui | Component primitives |
| TanStack Query v5 | Server state / data fetching |
| Zustand v5 | Client state |
| xterm.js | Terminal emulator |
| Monaco Editor | Code editor |
| Sonner | Toast notifications |

### 5.2 App Router Structure

```
app/
├── layout.tsx              # Root layout (server component)
├── page.tsx                # Landing / redirect
├── globals.css
├── (auth)/
│   ├── layout.tsx          # Auth layout ('use client')
│   ├── login/page.tsx      # Login
│   └── register/page.tsx   # Registration
└── (main)/
    ├── layout.tsx          # Authenticated shell ('use client')
    ├── dashboard/page.tsx  # Dashboard
    ├── chats/page.tsx      # AI Chat
    ├── files/page.tsx      # File manager
    ├── workspaces/page.tsx # Workspace list
    ├── workspace/[id]/     # Workspace detail
    ├── terminal/page.tsx   # Terminal
    ├── automations/page.tsx
    ├── datasets/page.tsx
    ├── personas/page.tsx
    ├── skills/page.tsx
    ├── channels/page.tsx
    ├── browser/page.tsx
    ├── hosting/page.tsx
    ├── snapshots/page.tsx
    ├── settings/page.tsx
    ├── admin/page.tsx
    ├── audit-log/page.tsx
    ├── rules/page.tsx
    ├── bookmarks/page.tsx
    ├── apps/page.tsx
    ├── space/page.tsx
    └── computer/page.tsx
```

**Known Issue:** app/(main)/layout.tsx is marked 'use client', forcing the entire authenticated shell into client-only rendering. This eliminates React Server Components benefits.

### 5.3 State Management

**Zustand Stores:**
- workspace.ts — Active workspace, editor state (persisted)
- persona.ts — Active persona (persisted)
- skills.ts — Active skills, 5-skill limit (persisted)

**Context API:**
- ChatPanelContext — Chat panel state, localStorage persistence

**TanStack Query:**
- useUser() — Auth user (retry: false)
- useQuery for messages, files, conversations
- useMutation for CRUD operations
- Query invalidation on mutations

### 5.4 Real-Time Communication

**WebSocket (Terminal):**
- services/runtime/src/routes.ts exposes WebSocket at /api/runtimes/:id/terminal
- Frontend: use-terminal.ts hook
- Bidirectional stream: PTY to xterm.js

**SSE (Task Events):**
- services/agent/src/routes.ts exposes SSE at /api/agent/tasks/:id/events
- Frontend: EventSource with withCredentials: true
- Events: task, step
- Cleanup on unmount

### 5.5 API Client Layer

```typescript
// apps/web/src/lib/api.ts
class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly correlationId?: string,
  ) {}
}
```

Axios instances per service with interceptors for correlation ID headers, cookie forwarding, and error extraction.

---

## 6. Data Model

### 6.1 Schema Modules

All schema lives in packages/db/src/schema/:

```
schema/
├── users.ts
├── sessions.ts
├── oauth_accounts.ts
├── audit_logs.ts
├── workspaces.ts
├── workspace_files.ts
├── runtimes.ts
├── runtime_logs.ts
├── runtime_events.ts
├── tasks.ts
├── task_steps.ts
├── memory_entries.ts
├── provider_credentials.ts
├── conversations.ts
├── tool_calls.ts
├── automations.ts
├── hosted_services.ts
├── snapshots.ts
├── notifications.ts
├── terminal.ts
├── skills.ts
├── channel_links.ts
└── datasets.ts
```

### 6.2 Key Relationships

```
users
├── sessions (1:N)
├── oauth_accounts (1:N)
├── workspaces (1:N)
│   ├── workspace_files (1:N)
│   ├── runtimes (1:N)
│   ├── snapshots (1:N)
│   └── hosted_services (1:N)
├── tasks (1:N)
│   └── task_steps (1:N)
├── conversations (1:N)
├── memory_entries (1:N)
├── provider_credentials (1:N)
├── skills (1:N)
├── personas (1:N)
├── channel_links (1:N)
├── datasets (1:N)
└── audit_logs (1:N)
```

### 6.3 Tenant Isolation

Every query must filter by user_id or workspace_id:

```typescript
// Correct pattern
.where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)))

// Memory service also uses SQL literal for pgvector
const conditions = [sql`user_id = ${userId}`];
```

### 6.4 Audit Log

Records all privileged actions: login/logout/register, API key add/revoke, preference changes, tool execution, snapshot restore/delete, channel link create/delete, hosted service lifecycle.

---

## 7. Infrastructure

### 7.1 Docker Compose Stack

File: infra/docker/docker-compose.yml

```yaml
services:
  postgres:    # PostgreSQL 16 + pgvector
  redis:       # Redis 7
  minio:       # S3-compatible object storage
  traefik:     # Reverse proxy + TLS
  mailhog:     # Email capture for dev
```

### 7.2 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | PostgreSQL connection string |
| REDIS_URL | Yes | Redis connection string |
| S3_ENDPOINT | Yes | MinIO endpoint |
| S3_ACCESS_KEY | Yes | S3 access key |
| S3_SECRET_KEY | Yes | S3 secret key |
| COOKIE_SECRET | Yes | Session cookie signing secret (>=32 bytes) |
| ENCRYPTION_KEY | Yes | 32-byte AES-256-GCM key |
| ADMIN_EMAIL | Optional | Admin email (gates /admin) |
| GOOGLE_CLIENT_ID | Optional | Google OAuth |
| GOOGLE_CLIENT_SECRET | Optional | Google OAuth |

### 7.3 Commands

```bash
# Infrastructure
pnpm infra:up        # Start Docker stack
pnpm infra:down      # Stop Docker stack
pnpm infra:logs      # View logs

# Database
pnpm db:migrate      # Run migrations
pnpm db:seed         # Seed data

# Development
pnpm dev             # Start all services + frontend
pnpm typecheck       # TypeScript check all packages
pnpm test            # Run all tests
pnpm lint            # ESLint (web + db only)
pnpm build           # Build all packages
pnpm format          # Prettier format

# Per-service
pnpm --filter @pcp/auth-service dev
pnpm --filter @pcp/workspace-service test
pnpm --filter web dev
```

---

## 8. Security Architecture

### 8.1 Authentication

| Mechanism | Used By | Details |
|-----------|---------|---------|
| Session Cookie | Browser clients | HTTP-only, SameSite=Lax, secure in prod |
| Bearer Token | Service-to-service | INTERNAL_SERVICE_TOKEN + X-User-Id header |
| OAuth 2.1 | Google login | PKCE flow |

### 8.2 Authorization

- Every DB query filters by user_id
- S3 paths are tenant-prefixed: {userId}/{workspaceId}/{path}
- Workspace ownership verified before file operations
- Admin routes gated by ADMIN_EMAIL

### 8.3 Encryption

| Data | Algorithm | Key Source |
|------|-----------|------------|
| Provider API keys (BYOK) | AES-256-GCM | ENCRYPTION_KEY (per-value IV) |
| Hosted service env vars | AES-256-GCM | ENCRYPTION_KEY (per-value IV) |
| Passwords | Argon2id | — |
| Session cookies | Signed (cookie secret) | COOKIE_SECRET |

### 8.4 Rate Limiting

| Route | Limit |
|-------|-------|
| Default (all services) | 100 req/min |
| Login/Register | 5 req/min |
| Telegram webhook | 60 req/min |

### 8.5 Container Security

- Non-root user (1000:1000)
- No network (NetworkMode: 'none')
- Read-only rootfs
- Dropped capabilities
- Seccomp/AppArmor profiles (configurable)
- Memory/CPU/PID limits
- tmpfs with noexec

### 8.6 Known Security Issues

| Issue | Severity | Location |
|-------|----------|----------|
| DuckDB SQL injection (read_parquet bypass) | Critical | workspace/datasets/service.ts |
| Telegram webhook z.any() | Critical | agent/routes/channels.ts |
| Missing path traversal guards | High | publish, runtime, browser |
| AUTH_BYPASS env variable | Medium | agent, browser env.ts |
| Weak .env.example defaults | Medium | infra/docker/.env.example |

---

## 9. Development Workflow

### 9.1 Adding a New Service

1. Create services/<name>/ with:
   - package.json (name: @pcp/<name>-service)
   - tsconfig.json
   - src/index.ts (Fastify init)
   - src/routes.ts (route definitions)
   - src/service.ts (business logic)
   - src/env.ts (Zod env validation)
2. Add to root package.json scripts (dev, build, test, typecheck)
3. Register in pnpm-workspace.yaml
4. Add health check endpoint (GET /health)
5. Use shared patterns: createApiErrorHandler, registerObservability, createCorsOptions

### 9.2 Adding a Database Table

1. Create schema file in packages/db/src/schema/<table>.ts
2. Export from packages/db/src/schema/index.ts
3. Run pnpm --filter @pcp/db generate
4. Run pnpm --filter @pcp/db migrate
5. Update @pcp/shared DTOs if needed

### 9.3 Conventions

- Files: index.ts (entry), routes.ts (HTTP), service.ts (logic)
- Naming: camelCase functions, PascalCase classes, Schema suffix for Zod
- Frontend components: kebab-case
- Tests: *.test.ts
- Frontend imports: @/ for apps/web/src
- Backend imports: @pcp/db, @pcp/shared

---

## 10. API Reference

### 10.1 Error Response Format

All services return a unified error envelope:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Unauthorized",
    "correlationId": "req-abc123"
  }
}
```

Error codes: BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, VALIDATION_ERROR, RATE_LIMITED, INTERNAL_ERROR

### 10.2 Authentication Headers

**Browser requests:**
- Cookie: sessionId=<uuid>

**Service-to-service:**
- Authorization: Bearer <INTERNAL_SERVICE_TOKEN>
- X-User-Id: <uuid>

### 10.3 Health Endpoints

| Service | URL |
|---------|-----|
| Auth | GET http://localhost:3001/health |
| Workspace | GET http://localhost:3002/health |
| Runtime | GET http://localhost:3003/health |
| Agent | GET http://localhost:3004/health |
| Memory | GET http://localhost:3005/health |
| Publish | GET http://localhost:3006/health |
| Browser | GET http://localhost:3007/health |

---

## 11. Testing Strategy

### 11.1 Test Coverage

| Package | Tests | Status |
|---------|-------|--------|
| apps/web | 0 | Missing |
| packages/db | 0 | Missing |
| packages/shared | 0 | By design (pure Zod) |
| services/auth | 43 | Passing |
| services/workspace | 25 | Passing |
| services/runtime | 23 | Passing |
| services/agent | 66 | Passing |
| services/memory | 15 | Passing |
| services/publish | 46 | Passing |
| services/browser | 14 | Passing |

**Total:** 232 tests, all passing

### 11.2 Test Patterns

- Unit tests: Service methods with mocked DB
- Integration tests: Route handlers with test database
- Security tests: Path traversal, tenant isolation
- Policy tests: Command blocklists, Docker security options

### 11.3 Running Tests

```bash
# All services
pnpm test

# Single service
pnpm --filter @pcp/workspace-service test

# Single file
pnpm --filter @pcp/workspace-service exec vitest run src/service.test.ts
```

---

## 12. Production Deployment

### 12.1 Pre-Production Checklist

- [ ] Generate cryptographically secure ENCRYPTION_KEY (32 bytes, no dev- prefix)
- [ ] Generate strong COOKIE_SECRET (>=32 bytes)
- [ ] Set unique POSTGRES_PASSWORD (not dev default)
- [ ] Set unique MINIO_ROOT_PASSWORD
- [ ] Configure ADMIN_EMAIL
- [ ] Set NODE_ENV=production on all services
- [ ] Verify AUTH_BYPASS is disabled
- [ ] Enable HTTPS/TLS (Let's Encrypt via Traefik)
- [ ] Configure CORS to exact domain (not true)
- [ ] Set secure: true on session cookies
- [ ] Set sameSite: strict on cookies
- [ ] Enable PostgreSQL SSL
- [ ] Run migrations: pnpm --filter @pcp/db migrate

### 12.2 Scaling Considerations

| Component | Scaling Strategy |
|-----------|------------------|
| Auth, Workspace, Agent, Publish | Horizontal (stateless) |
| Runtime | Sticky sessions (WebSocket PTY) |
| BullMQ Workers | Scale agent service instances |
| Database | Read replicas, PgBouncer pooling |
| Redis | Managed Redis with AOF persistence |

### 12.3 Backup Strategy

| Component | Method | Frequency |
|-----------|--------|-----------|
| PostgreSQL | pg_dump or managed backups | Daily |
| MinIO/S3 | Bucket versioning + cross-region | Continuous |
| Redis | AOF persistence + snapshots | Hourly |

Scripts: scripts/backup.sh, scripts/restore.sh

---

## 13. Roadmap & Issues

### 13.1 Production Blockers

| Priority | Item |
|----------|------|
| P0 | Fix DuckDB SQL injection in dataset queries |
| P0 | Add Zod schema validation to Telegram webhook |
| P1 | Centralize assertSafePath() in @pcp/shared |
| P1 | Remove @ts-ignore in auth OAuth callback |
| P1 | Fix lint error in register page (apostrophe entity) |
| P2 | Unify Vitest versions across services |
| P2 | Pin drizzle-orm version (remove "latest") |
| P2 | Add ESLint to all services |

### 13.2 Open Work

| Area | Item |
|------|------|
| Streaming | SSE/WS streaming for chat (currently single-shot) |
| Token Telemetry | Cost tracking on task_steps |
| Approval Gating | Required approval for high-risk tools |
| Retrieval Reranking | On top of pgvector HNSW |
| Observability | OpenTelemetry traces across agent loop |
| Frontend | WebSocket/SSE streaming, optimistic mutations, a11y pass, i18n |
| CI/CD | No CI pipeline yet (typecheck to lint to test + smoke) |

### 13.3 Planned Improvements

| Area | Plan |
|------|------|
| Sandbox | Seccomp + AppArmor profiles, read-only rootfs, network egress allow-list |
| Runtime | CPU/RAM/wall-clock limits for run_command |
| Agent | Streaming responses, token/cost telemetry |
| Frontend | Suspense boundaries, loading.tsx, middleware.ts for edge auth |
| Auth | Centralized auth middleware package (currently re-implemented per service) |
| Infra | CI pipeline, Docker image scanning (Trivy/Snyk) |

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| BYOK | Bring Your Own Key — user-supplied LLM API credentials |
| MCP | Model Context Protocol — tool standardization |
| Persona | User-defined system prompt preset |
| Skill | Reusable capability injected into agent context |
| PTY | Pseudo-Terminal — interactive shell session |
| ReAct | Reasoning + Acting loop pattern for agents |
| HNSW | Hierarchical Navigable Small World — vector search index |

## Appendix B: File Reference

| File | Purpose |
|------|---------|
| AGENTS.md | Repo conventions, gotchas, commands |
| README.md | Project overview, quick start |
| docs/PROGRESS.md | Current status and open work |
| docs/PRODUCTION.md | Production deployment guide |
| docs/DECISIONS.md | Architectural decisions (ADRs) |
| docs/DATA_MODEL.md | Full schema reference |
| docs/AGENT.md | Agent loop, tools, BYOK details |

---

*End of Document*
