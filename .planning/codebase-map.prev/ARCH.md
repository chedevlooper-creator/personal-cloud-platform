# Architecture Map — personal-cloud-platform

**Analysis date:** 2026-04-27
**Scope:** topology, data flow, inter-service communication, layering, schema graph,
auth propagation, frontend architecture, async work, config, shared packages.
**Method:** read source under `apps/`, `services/`, `packages/`, `infra/`. The
`.cursor/rules/*.mdc` files describe an aspirational architecture; this doc records
**actual code**, calling out divergences.

---

## 1. Topology

### 1.1 Workspace shape

`pnpm-workspace.yaml` declares:

```
apps/*       -> apps/web (the only app)
services/*   -> auth, workspace, agent, runtime, memory, publish
packages/*   -> @pcp/db, @pcp/shared
```

There is **no** `apps/api` and no API gateway. Services are exposed directly to
the browser on different localhost ports. Traefik is in `infra/docker/docker-compose.yml`
(`infra/docker/docker-compose.yml:65-83`) but is wired only to orchestrate
_published user apps_ (see §6), not to front the platform services themselves.

### 1.2 Service catalog

| Process   | Pkg name                 | Port | Entrypoint                           | Route prefix | Responsibility                                          |
| --------- | ------------------------ | ---- | ------------------------------------ | ------------ | ------------------------------------------------------- |
| Auth      | `@pcp/auth-service`      | 3001 | `services/auth/src/index.ts:48`      | `/auth`      | Email+password, Google OAuth, sessions, audit logs      |
| Workspace | `@pcp/workspace-service` | 3002 | `services/workspace/src/index.ts:45` | `/api`       | Workspaces & files (DB rows + MinIO blobs)              |
| Runtime   | `@pcp/runtime-service`   | 3003 | `services/runtime/src/index.ts:41`   | `/api`       | Per-workspace Docker containers + xterm WebSocket       |
| Agent     | `@pcp/agent-service`     | 3004 | `services/agent/src/index.ts:39`     | `/api`       | Conversations, tasks, agent loop, tool calls, approvals |
| Memory    | `@pcp/memory-service`    | 3005 | `services/memory/src/index.ts:38`    | `/api`       | pgvector-backed long-term memory + embedding search     |
| Publish   | `@pcp/publish-service`   | 3006 | `services/publish/src/index.ts:40`   | `/publish`   | Published user apps + Traefik-labeled containers        |
| Web       | `web` (Next.js 16)       | 3000 | `apps/web` (next dev)                | n/a          | UI; calls all of the above directly with cookies        |

All Fastify services follow the same skeleton: `validatorCompiler` /
`serializerCompiler` from `fastify-type-provider-zod`, `@fastify/cors`
(`origin: true, credentials: true`), `@fastify/cookie`, and a `/health` endpoint.
Auth additionally registers `@fastify/rate-limit` (`services/auth/src/index.ts:30`)
and `@fastify/oauth2` (`services/auth/src/routes.ts:12`); workspace registers
`@fastify/multipart` for uploads (`services/workspace/src/index.ts:33`); runtime
registers `@fastify/websocket` (`services/runtime/src/index.ts:33`).

### 1.3 Infra (`infra/docker/docker-compose.yml`)

| Container | Image                    | Port(s)         | Used by                                           |
| --------- | ------------------------ | --------------- | ------------------------------------------------- |
| postgres  | `pgvector/pgvector:pg16` | 5432            | every service (via `@pcp/db`)                     |
| redis     | `redis:7-alpine`         | 6379            | **dead code only** — see §8                       |
| minio     | `minio/minio:latest`     | 9000 (S3), 9001 | `services/workspace` (`S3WorkspaceObjectStorage`) |
| traefik   | `traefik:v3.0`           | 80, 443, 8080   | `services/publish` deployment containers          |
| mailhog   | `mailhog/mailhog`        | 1025, 8025      | not referenced from any service yet               |

Postgres seed file: `infra/docker/postgres/init.sql` (mounted in compose).

### 1.4 ASCII topology

```
              +---------------------------+
              |   browser (apps/web)       |
              |   Next.js 16 dev :3000     |
              |   axios w/ withCredentials |
              +---+---+---+---+---+--------+
                  |   |   |   |   |
                  v   v   v   v   v
         :3001  :3002 :3003 :3004 :3005 :3006
         auth  ws    rt    agent mem   publish
          |     |     |     |     |     |
          |     +-->S3 (MinIO)    |     |
          |     |     |     |     |     +--> dockerd (publish containers, Traefik labels)
          |     |     +--> dockerd (workspace runtime containers)
          |     |     |     |     |
          v     v     v     v     v
       +-----------------------------------+
       |     Postgres (pgvector pg16)       |
       |  every service uses @pcp/db        |
       |  no service-to-service HTTP yet    |
       +-----------------------------------+
```

---

## 2. Data flows

Three representative flows, traced through real code.

### 2.1 Login

```
browser  POST http://localhost:3001/auth/login   (body { email, password })
   |
   v
services/auth/src/index.ts:46   register(setupAuthRoutes, { prefix: '/auth' })
services/auth/src/routes.ts:64  POST /login
   - body validated via @pcp/shared/loginSchema
   - calls AuthService.login (services/auth/src/service.ts:51)
       1. db.query.users.findFirst by email
       2. argon2.verify(password)
       3. createSession() inserts row in `sessions` (id = crypto.randomBytes(32).hex)
       4. logAudit('auth.login') -> insert into `audit_logs`
   - reply.setCookie('sessionId', session.id, httpOnly, sameSite=lax, 30d)
   - returns { user }
```

After this, the browser holds the `sessionId` cookie. Every other service reads
that cookie via `request.cookies.sessionId` and calls its own DB-backed
session lookup (see §5).

### 2.2 Workspace file CRUD (e.g. open + edit a file)

```
1) Page load (workspace list)
   browser -> GET http://localhost:3002/api/workspaces
   services/workspace/src/routes.ts:51-78  list endpoint
     - getAuthenticatedUserId(cookies.sessionId)
       -> WorkspaceService.validateUserFromCookie (services/workspace/src/service.ts:168)
       -> SELECT sessions WHERE id=...; expiry check; SELECT users
     - WorkspaceService.listUserWorkspaces -> SELECT workspaces WHERE user_id=...

2) File tree
   browser -> GET /api/workspaces/:id/files?path=/
   services/workspace/src/routes.ts:131-157
     - same auth path
     - WorkspaceService.listFiles (service.ts:227)
       - SELECT workspaces (tenant gate)
       - SELECT workspace_files WHERE workspace_id=... and deleted_at IS NULL
       - filters by parent_path in JS

3) Open a text file
   browser -> GET /api/workspaces/:id/files/content?path=/README.md
   routes.ts:160-188
     - WorkspaceService.getFileContent (service.ts:257)
       - getFile (DB row) -> guards: not directory, size <= 256KB, isTextFile
       - storage.getText(storageKey)
         -> S3 GetObjectCommand against MinIO @ S3_ENDPOINT (default
            http://localhost:9000, bucket `pcp-workspace`, path-style)

4) Upload
   browser -> POST /api/workspaces/:id/upload  (multipart)
   routes.ts:301-346
     - request.file() (via @fastify/multipart, 50MB cap, index.ts:35)
     - WorkspaceService.uploadFile (service.ts:332)
       - storage.putStream(key, stream, mimeType)  [@aws-sdk/lib-storage Upload]
       - upserts workspace_files row
       - updates workspaces.storage_used (storage_limit default 10 GiB,
         packages/db/src/schema/workspaces.ts:8)

5) Move / delete: same shape, mutate workspace_files; deletion is soft
   (`deleted_at = now()`), which decrements storage_used.
```

Storage key format: `${userId}/${workspaceId}${normalizedPath}`
(`services/workspace/src/service.ts:511`). This is the only tenant prefix in
object storage and matches the `.cursor/rules/security.mdc` claim.

### 2.3 Agent chat task

```
browser (chat panel) -> POST http://localhost:3004/api/agent/tasks
                        body: { workspaceId, conversationId?, input }
services/agent/src/routes.ts:50-68
  - getAuthenticatedUserId(cookies.sessionId)   (with AUTH_BYPASS=1 escape hatch
                                                 -> 'local-dev-user', routes.ts:12)
  - AgentOrchestrator.createTask (orchestrator.ts:107)
      1. If no conversationId -> insert into `conversations`
      2. Insert into `tasks` (status='pending')
      3. Fire-and-forget: this.runAgentLoop(task.id, userId)  (orchestrator.ts:130)
      4. Return task immediately (HTTP 201)

runAgentLoop (orchestrator.ts:176):
  - UPDATE tasks SET status='executing'
  - messages = [system, user(task.input)]
  - loop up to 15 iterations:
      a) Re-read task; bail if cancelled
      b) llm.generate(messages, tools)   <-- HTTP to OpenAI / Anthropic / MiniMax
         provider chosen by env LLM_PROVIDER (services/agent/src/llm/provider.ts:12)
      c) If response.content -> insert task_steps row {type:'thought', content}
      d) If response.toolCalls[0] exists:
         - Insert tool_calls row (status 'awaiting_approval' if toolName==='run_command',
           else 'running')   [hard-coded approval rule — see Discrepancies]
         - Insert task_steps row {type:'action', toolName, toolInput}
         - If approval required: UPDATE tasks SET status='waiting_approval'; return
         - Else: registry.execute(name, argsJSON, ctx)
             - currently every tool returns simulated data
               (e.g. read_file.ts:29 "Simulated file content for ${path}")
         - Insert task_steps row {type:'observation', toolOutput}
         - push observation back into messages, continue loop
      e) No toolCalls -> UPDATE tasks SET status='completed', output=content; return
  - max iterations exceeded -> status='failed'

browser polls:
  - GET /api/agent/tasks/:id           (routes.ts:70)
  - GET /api/agent/tasks/:id/steps     (routes.ts:91)
  Approval flow:
  - POST /api/agent/tasks/:id/tool-approval  (routes.ts:167)
    -> orchestrator.submitToolApproval (orchestrator.ts:286)
       UPDATE tool_calls; on approve, executes tool synchronously and resumes
       runAgentLoop. on reject, logs observation and resumes.
```

All persistence is direct Postgres writes from the orchestrator. There is no
streaming (no SSE, no WebSocket); the frontend `apps/web/src/components/workspace/chat.tsx`
polls the task and steps endpoints.

There is also a one-shot `POST /api/agent/chat` (`routes.ts:17`) that bypasses
the task machinery and just calls `llm.generate` — used by the home/chat
landing screen.

---

## 3. Inter-service communication

**Actually:** services do **not** call each other over HTTP, Redis, or any
message bus. Every service imports `@pcp/db` directly and reads/writes the
same Postgres schema. Sessions, workspaces, tasks, etc. are looked up in-place.

Evidence:

- `services/workspace/src/service.ts:1-11` imports `db, sessions, users, workspaceFiles, workspaces` from `@pcp/db`.
- `services/agent/src/orchestrator.ts:1-2` imports `tasks, taskSteps, users, sessions, conversations, toolCalls`.
- `services/runtime/src/service.ts:1-2` imports `runtimes, runtimeLogs, runtimeEvents, sessions, users`.
- `services/memory/src/service.ts:1-2` imports `memoryEntries, users, sessions`.
- `services/publish/src/service.ts:1-2` imports `publishedApps, appDeployments`.
- No `axios`, `fetch`, `undici`, or `@pcp/*-client` imports between services
  (verified with ripgrep — only outbound HTTP is from the auth service to
  Google's `oauth2/v2/userinfo` and from the agent service to LLM APIs).

**Aspirational vs actual.** `.cursor/rules/architecture.mdc` says "No
cross-service DB access — services talk over HTTP / Redis pub/sub / BullMQ."
That rule is **not enforced anywhere**. Every service shares the DB; effectively
the database _is_ the shared bus.

There is one unused exception: `services/agent/src/automation/queue.ts` defines
a BullMQ queue + worker on Redis, but nothing imports `setupAutomationWorker`
or `automationQueue` (verified via ripgrep). It is dead code; see §8.

---

## 4. Per-service internal layering

The rule (`.cursor/rules/architecture.mdc`, `.cursor/rules/backend-standards.mdc`)
specifies `route -> service -> repository`, with the repository layer as the
only DB consumer. That layering is **partially observed**:

| Service   | route → service split?                | repository layer?                              | DB called from routes? |
| --------- | ------------------------------------- | ---------------------------------------------- | ---------------------- |
| auth      | yes (`routes.ts` + `service.ts`)      | no — `AuthService` owns Drizzle calls          | no                     |
| workspace | yes                                   | no — `WorkspaceService` calls Drizzle directly | no                     |
| agent     | yes (`routes.ts` + `orchestrator.ts`) | no — orchestrator does DB + LLM + tool exec    | no                     |
| runtime   | yes (`routes.ts` + `service.ts`)      | no — service calls Drizzle and DockerProvider  | no                     |
| memory    | yes                                   | no — service does embeddings + raw SQL         | no                     |
| publish   | yes (`routes.ts` + `service.ts`)      | no — service calls Drizzle and dockerode       | no                     |

So: the `route → service` boundary exists, but **no service has a separate
repository module**. Drizzle queries are written inline inside service classes.
None of the routes call the DB directly; the violation is at the
service↔repository boundary, not at the route boundary.

Examples of in-service DB calls:

- `services/workspace/src/service.ts:170` (`db.query.sessions.findFirst`)
- `services/agent/src/orchestrator.ts:119` (`db.insert(tasks).values(...)`)
- `services/memory/src/service.ts:67` (`db.execute(sql\`SELECT ... <-> ${embedding}::vector\`)`)
- `services/publish/src/service.ts:20` (`db.insert(publishedApps).values(...)`)

DTOs/schemas are correctly centralised in `@pcp/shared` as the rule requests,
but several routes also define one-off Zod schemas inline (e.g.
`services/agent/src/routes.ts:21-35`, `services/workspace/src/routes.ts:233-241`).

---

## 5. Authentication propagation

### 5.1 Cookie

The auth service issues a 30-day cookie:

```
sessionId = crypto.randomBytes(32).toString('hex')   (auth/src/service.ts:181)
httpOnly: true, sameSite: 'lax',
secure: NODE_ENV === 'production',
path: '/', maxAge: 30d
```

Set in `services/auth/src/routes.ts:52, 89, 144, 197` (register / login / refresh
/ OAuth callback).

Because every service is on `localhost:300X`, the cookie is scoped per host —
it works in dev because all axios clients in `apps/web/src/lib/api.ts:10-33`
use `withCredentials: true` and each service registers `@fastify/cors` with
`credentials: true`.

### 5.2 Session validation: `validateUserFromCookie`

There are **five copies** of essentially the same function, one per non-auth
service:

| File                                                   | Line | Owner class                  |
| ------------------------------------------------------ | ---- | ---------------------------- |
| `services/workspace/src/service.ts`                    | 168  | `WorkspaceService`           |
| `services/runtime/src/service.ts`                      | 15   | `RuntimeService`             |
| `services/agent/src/orchestrator.ts`                   | 27   | `AgentOrchestrator`          |
| `services/memory/src/service.ts`                       | 15   | `MemoryService`              |
| `services/auth/src/service.ts:116` (`validateSession`) | -    | `AuthService` (the original) |

All of them implement the same logic:

```ts
const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
if (!session || session.expiresAt < now) return null;
const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
return user?.id ?? null;
```

The auth service version (`AuthService.validateSession`) additionally extends
the session expiry if <15 days remain (`auth/src/service.ts:128-135`). The
copies in other services do **not** extend expiry — only `/auth/refresh`
rotates it.

`services/publish/src/service.ts` does **not** validate sessions at all; its
routes accept `userId` from the request body/query (`publish/src/routes.ts:13,
49`). This is a real authorization hole vs the other services.

`services/agent/src/routes.ts:12` adds an `AUTH_BYPASS=1` escape hatch that
substitutes a literal user id `'local-dev-user'`; that user must exist in the
DB or task creation will FK-fail.

### 5.3 Frontend hook-up

- `apps/web/src/lib/api.ts` exports five axios clients with `withCredentials: true`,
  each pointed at a separate `NEXT_PUBLIC_*_API_URL` env (defaults match the
  port table in §1.2).
- `apps/web/src/lib/auth.ts` wraps `/auth/me`, `/auth/login`, `/auth/register`,
  `/auth/logout` in TanStack Query hooks (`useUser`, `useLogin`, `useRegister`,
  `useLogout`).
- `apps/web/src/proxy.ts` exports a `proxy(request)` function that would gate
  routes on the `sessionId` cookie. **It is dead code**: Next.js middleware must
  live at `apps/web/src/middleware.ts` (or `app/middleware.ts`); there is no
  such file. So all client-side route protection currently relies on the
  `useUser()` hook and `(auth)` vs `(main)` segment layouts. Login/register
  pages live under `(auth)`; everything else is under `(main)` and renders the
  `AppShell` (`apps/web/src/app/(main)/layout.tsx:8`).

---

## 6. Frontend architecture (`apps/web`)

Next.js 16 + React 19 + Tailwind v4 + shadcn. Note the per-package
`apps/web/AGENTS.md` warns that this Next is post-training-data; conventions
may differ.

### 6.1 Route segments

```
apps/web/src/app/
  layout.tsx                 # html/body, Inter + JetBrainsMono, <Providers>
  globals.css                # tailwind v4 @import
  page.tsx                   # marketing/landing
  (auth)/
    login/page.tsx
    register/page.tsx
  (main)/
    layout.tsx               # 'use client'; wraps children in <AppShell user={...}> + <Toaster>
    dashboard/page.tsx
    workspaces/page.tsx
    workspace/[id]/page.tsx  # IDE-style shell (file tree + editor + terminal + chat)
    files/page.tsx
    chats/page.tsx
    automations/page.tsx
    bookmarks/page.tsx
    apps/page.tsx
    hosting/page.tsx
    snapshots/page.tsx
    skills/page.tsx
    settings/page.tsx
    space/page.tsx
    computer/page.tsx
    terminal/page.tsx
    datasets/page.tsx
```

There are several `* 2.tsx`/`* 3.tsx` duplicates (e.g. `dashboard/page 2.tsx`,
`workspace/[id]/page 2.tsx`). These are macOS Finder-style copies, not Next
routes. Treat as historical scratch.

### 6.2 Shared shell

`apps/web/src/components/app-shell/`:

- `app-shell.tsx` — top-level container; wires `<Sidebar>` + `<MainCanvas>` and
  `<KeyboardShortcutProvider>` (`apps/web/src/components/app-shell/app-shell.tsx:11-31`).
- `sidebar.tsx`, `sidebar-item.tsx` — left rail nav.
- `main-canvas.tsx` — content area with header, mobile sidebar trigger.
- `chat-composer.tsx`, `chat-home.tsx` — landing chat input that calls
  `agentApi.post('/agent/chat')` (`apps/web/src/components/app-shell/chat-home.tsx:90`).
- `command-palette.tsx`, `model-selector.tsx`, `persona-selector.tsx`,
  `plan-badge.tsx`, `status-toast.tsx`, `tool-approval-card.tsx`,
  `workspace-account-card.tsx`, `workspace-identity-bar.tsx`,
  `dotted-background.tsx`, `module-placeholder.tsx`,
  `keyboard-shortcut-provider.tsx`.
- `apps/web/src/components/workspace/` — IDE pieces: `workspace-shell.tsx`,
  `file-tree.tsx`, `editor.tsx`, `terminal.tsx`, `chat.tsx`,
  `create-workspace-dialog.tsx`.
- `apps/web/src/components/ui/` — shadcn primitives (button, dialog, tabs,
  tooltip, sonner, theme-toggle, error-boundary, etc.).
- `apps/web/src/components/providers.tsx` — wraps children in
  TanStack Query / theme providers (referenced from `app/layout.tsx`).

### 6.3 State & data

- **Server state:** `@tanstack/react-query` everywhere. Auth hooks in
  `apps/web/src/lib/auth.ts:11-71`; per-page ad hoc `useQuery` (`chats/page.tsx:68,
78`, `hosting/page.tsx:46-56`).
- **Client state:** zustand, single store in `apps/web/src/store/workspace.ts`
  (`useWorkspaceStore` — current workspace id, selected file, open files,
  sidebar). No other zustand stores currently exist.
- **API layer:** `apps/web/src/lib/api.ts` (the canonical client); a duplicate
  `apps/web/src/lib/auth 2.ts` exists alongside `auth.ts` (Finder copy — ignore).
  Some pages still construct their own axios calls inline (e.g.
  `apps/web/src/app/(main)/dashboard/page 2.tsx:5`).

### 6.4 Hooks

- `apps/web/src/hooks/use-terminal.ts` — connects to runtime WS terminal at
  `ws://localhost:3003/api/runtimes/:id/terminal` (mirrors
  `services/runtime/src/routes.ts:101-144`).

### 6.5 Middleware / proxy

`apps/web/src/proxy.ts` defines a `proxy()` request handler with a `config.matcher`
intended to redirect unauthenticated traffic to `/login`. **Next.js does not
execute this file** — middleware must be at `src/middleware.ts`. So as of today,
auth gating is purely client-side via `useUser()` and segment layouts. That's
worth fixing or deleting.

---

## 7. Schema graph (`packages/db/src/schema/*`)

20 tables defined; index at `packages/db/src/schema/index.ts:1-22`. All tables
use `uuid` PKs except `sessions.id` which is `varchar(255)` (the random hex
session token, see auth/src/service.ts:181). Every user-scoped table cascades
on `users.id` delete.

| Table                  | File                        | Owner-by-write                       | Read by                                    | FKs                                                                         |
| ---------------------- | --------------------------- | ------------------------------------ | ------------------------------------------ | --------------------------------------------------------------------------- |
| `users`                | `users.ts`                  | auth                                 | every service (session validation)         | —                                                                           |
| `sessions`             | `sessions.ts`               | auth                                 | every service                              | `user_id -> users.id (cascade)`                                             |
| `oauth_accounts`       | `oauth_accounts.ts`         | auth                                 | auth                                       | `user_id -> users.id (cascade)`; PK (provider_id, provider_user_id)         |
| `audit_logs`           | `audit_logs.ts`             | auth                                 | (none)                                     | `user_id -> users.id (set null)`                                            |
| `workspaces`           | `workspaces.ts`             | workspace                            | workspace, runtime, agent, memory, publish | `user_id -> users.id (cascade)`                                             |
| `workspace_files`      | `workspace_files.ts`        | workspace                            | workspace                                  | `workspace_id -> workspaces.id (cascade)`                                   |
| `runtimes`             | `runtimes.ts`               | runtime                              | runtime                                    | `user_id -> users.id`, `workspace_id -> workspaces.id` (cascade)            |
| `runtime_logs`         | `runtime_logs.ts`           | runtime                              | runtime                                    | `runtime_id -> runtimes.id (cascade)`                                       |
| `runtime_events`       | `runtime_events.ts`         | runtime                              | runtime                                    | `runtime_id -> runtimes.id (cascade)`                                       |
| `conversations`        | `conversations.ts`          | agent                                | agent                                      | `user_id -> users.id (cascade)`, `workspace_id -> workspaces.id (set null)` |
| `tasks`                | `tasks.ts`                  | agent                                | agent                                      | `user_id`, `workspace_id` (cascade); `conversation_id` FK app-side only     |
| `task_steps`           | `task_steps.ts`             | agent                                | agent                                      | `task_id -> tasks.id (cascade)`                                             |
| `tool_calls`           | `tool_calls.ts`             | agent                                | agent                                      | `task_id -> tasks.id`, `user_id -> users.id` (cascade)                      |
| `approval_requests`    | `tool_calls.ts` (same file) | (none — code defines, never inserts) | (none)                                     | `user_id`, `task_id`, `tool_call_id` (cascade)                              |
| `memory_entries`       | `memory_entries.ts`         | memory                               | memory                                     | `user_id`, `workspace_id` (cascade); `embedding vector(1536)`               |
| `published_apps`       | `publish.ts`                | publish                              | publish                                    | `user_id`, `workspace_id` (cascade); `subdomain` unique                     |
| `app_deployments`      | `publish.ts`                | publish                              | publish                                    | `app_id -> published_apps.id (cascade)`                                     |
| `provider_credentials` | `provider_credentials.ts`   | (none — schema only)                 | (none)                                     | `user_id -> users.id (cascade)`                                             |
| `user_preferences`     | `provider_credentials.ts`   | (none)                               | (none)                                     | `user_id -> users.id (cascade)`, PK = user_id                               |
| `automations`          | `automations.ts`            | (queue worker — dead code)           | (dead code)                                | `user_id`, `workspace_id (set null)`                                        |
| `automation_runs`      | `automations.ts`            | (queue worker — dead code)           | (dead code)                                | inferred — see file                                                         |
| `hosted_services`      | `hosted_services.ts`        | (none)                               | (none)                                     | `user_id`, `workspace_id` (cascade)                                         |
| `snapshots`            | `snapshots.ts`              | (none)                               | (none)                                     | `user_id`, `workspace_id` (cascade)                                         |
| `notifications`        | `notifications.ts`          | (none)                               | (none)                                     | `user_id -> users.id (cascade)`                                             |
| `integrations`         | `notifications.ts`          | (none)                               | (none)                                     | `user_id -> users.id (cascade)`                                             |
| `terminal_sessions`    | `terminal.ts`               | (none)                               | (none)                                     | `user_id`, `workspace_id` (cascade)                                         |
| `terminal_commands`    | `terminal.ts`               | (none)                               | (none)                                     | `session_id -> terminal_sessions.id`, `user_id -> users.id`                 |
| `skills`               | `skills.ts`                 | (none)                               | (none)                                     | `user_id`, `workspace_id` (cascade)                                         |

Many "advanced" tables (automations, hosted*services, snapshots, notifications,
integrations, terminal*_, skills, provider*credentials, user_preferences,
approval_requests) exist as schema with migrations in
`packages/db/src/migrations/000{0..7}*_.sql`but are **not yet read or written
by any service**. They are scaffolded for upcoming features. The
corresponding UI pages exist in`apps/web/src/app/(main)/...` (skills,
snapshots, automations, hosting), so the gap is in the backend services.

`memory_entries.embedding` is a custom Drizzle type (`vector(1536)`,
`packages/db/src/schema/memory_entries.ts:7-17`) backed by pgvector. The
`memory` service uses raw SQL (`db.execute(sql\`... <-> ${embeddingStr}::vector ...\`)`,
`services/memory/src/service.ts:67-74`) for similarity search — this is the
only place raw SQL is used.

Drizzle client and connection pool: `packages/db/src/client.ts:1-19` validates
`DATABASE_URL` (URL string) and `DB_MAX_CONNECTIONS` (default 10) with Zod at
import time, then exports `db` (postgres-js + drizzle).

Migrations live in `packages/db/src/migrations/0000_*.sql` through
`0007_red_khan.sql` with snapshots in `meta/`.

---

## 8. Background jobs / async work

**In-process async only.**

- The agent loop (`services/agent/src/orchestrator.ts:130`) is a
  fire-and-forget Promise inside the agent process. If the process restarts
  mid-task, the task remains stuck in `executing`/`waiting_approval` with no
  recovery code.
- `services/publish/src/service.ts:61` (`runDeployment`) is also a
  fire-and-forget Promise that creates an nginx container.
- The frontend **polls** for task status; there is no SSE, no WebSocket-based
  agent stream. The only WebSocket in the system is the runtime terminal
  (`services/runtime/src/routes.ts:101-144`).
- BullMQ is installed (`services/agent/package.json:18,22` — `bullmq`, `ioredis`)
  and there is a queue/worker file at `services/agent/src/automation/queue.ts`
  that wires `automations` → `automation_runs` and calls `orchestrator.createTask`.
  However `services/agent/src/index.ts` does **not** import it and no
  scheduler/cron writes jobs onto the queue. The queue is dead code today.
- No cron/timers/intervals exist anywhere else (verified via ripgrep for
  `setInterval`, `node-cron`, `bree`).
- Redis is up in `infra/docker/docker-compose.yml` but no live code connects
  to it — `infra:up` provisions it for the unfinished automation worker.

---

## 9. Configuration & secrets

- All config via env vars; **no central env loader** at the workspace root.
- `packages/db/src/client.ts:7-12` validates `DATABASE_URL` + `DB_MAX_CONNECTIONS`
  with Zod. This is the **only** Zod-validated startup env in the codebase.
- Other services read env vars ad hoc with `||` fallbacks to insecure defaults:
  - `services/auth/src/index.ts:36` — `COOKIE_SECRET || 'super-secret-key-replace-in-prod'`
    (same default in workspace, runtime, agent, memory; `services/publish/src/index.ts:32`
    registers cookie with no secret at all).
  - `services/auth/src/routes.ts:16-22` — `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL`
    default to `dummy_*`.
  - `services/agent/src/llm/provider.ts:12-32` — `LLM_PROVIDER`, `OPENAI_API_KEY`,
    `OPENAI_MODEL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_BASE_URL`,
    `MINIMAX_TOKEN_PLAN_API_KEY`, `MINIMAX_API_KEY`, `MINIMAX_MODEL`,
    `MINIMAX_BASE_URL`. All fall back to `'dummy_key'`.
  - `services/memory/src/service.ts:11` — `OPENAI_API_KEY` (for embeddings),
    same `dummy_key` fallback.
  - `services/workspace/src/service.ts:34-42` — `S3_BUCKET`, `S3_REGION`,
    `S3_ENDPOINT`, `S3_ACCESS_KEY`/`MINIO_ROOT_USER`,
    `S3_SECRET_KEY`/`MINIO_ROOT_PASSWORD`.
  - `services/agent/src/automation/queue.ts:9` — `REDIS_URL`.
  - `apps/web/src/lib/api.ts:4-7,26` — `NEXT_PUBLIC_AUTH_API_URL`,
    `NEXT_PUBLIC_WORKSPACE_API_URL`, `NEXT_PUBLIC_AGENT_API_URL`,
    `NEXT_PUBLIC_RUNTIME_API_URL`, `NEXT_PUBLIC_PUBLISH_API_URL`.
  - `apps/web/src/proxy.ts:5` and `services/agent/src/routes.ts:12` —
    `AUTH_BYPASS=1` escape hatch.
- The agent service is unique in shipping its own dotenv loader at
  `services/agent/src/env.ts:1-65`: it walks up to the workspace root and reads
  `.env.local`, `.env`, and `infra/docker/.env`, applying any keys not
  already in `process.env`. Other services rely on the shell to set env vars
  (or on `tsx watch` plus a `.env` next to the service).
- Production cookie hardening is conditional on `NODE_ENV === 'production'`
  (e.g. `services/auth/src/routes.ts:56`).
- `infra/docker/.env` is gitignored and must be copied from `infra/docker/.env.example`.

`.cursor/rules/architecture.mdc` says "Config via env, validated with Zod at
startup" — only `packages/db` actually does that.

---

## 10. Shared packages

### 10.1 `@pcp/db` (`packages/db`)

- `src/client.ts` — drizzle-orm + postgres-js client, Zod-validated env.
- `src/schema/*` — 22 schema files; aggregated by `src/schema/index.ts`.
- `src/migrations/*.sql` + `meta/_journal.json` — drizzle-kit output.
- `src/seed.ts` — local seed entrypoint.
- Scripts (`packages/db/package.json`): `generate`, `migrate`, `push`,
  `studio`, `seed`. Has its own `lint` script (only `apps/web` and
  `packages/db` ship lint, per root `AGENTS.md`).
- Consumers import from `@pcp/db/src/client` and `@pcp/db/src/schema`
  directly (e.g. `services/auth/src/service.ts:1-2`). There is no built
  bundle; services compile against `src/`.

### 10.2 `@pcp/shared` (`packages/shared`)

Pure TS, no build step (per root `AGENTS.md`). Files (with line counts):

| File                | Lines | Exports (high level)                                                                                                                                               |
| ------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/auth.ts`       | 26    | `registerSchema`, `loginSchema`, `authResponseSchema`, user DTO                                                                                                    |
| `src/workspace.ts`  | 63    | `createWorkspaceSchema`, `listWorkspacesSchema`, `listFilesSchema`, `moveFileSchema`, `workspaceResponseSchema`, `fileMetadataSchema`, `fileContentResponseSchema` |
| `src/runtime.ts`    | 23    | `createRuntimeSchema`, `execCommandSchema`, `runtimeResponseSchema`                                                                                                |
| `src/agent.ts`      | 60    | `createTaskSchema`, `taskResponseSchema`, `taskStepSchema`, `conversationResponseSchema`, `messageResponseSchema`, `toolApprovalSchema`                            |
| `src/memory.ts`     | 32    | `addMemorySchema`, `searchMemorySchema`, `updateMemorySchema`, `memoryResponseSchema`                                                                              |
| `src/automation.ts` | 54    | (defined but **not exported** from `index.ts:1-5`)                                                                                                                 |
| `src/index.ts`      | 5     | re-exports auth/workspace/runtime/agent/memory                                                                                                                     |

`automation.ts` is orphaned — it's not in `index.ts` and nothing imports it
directly. The agent BullMQ queue file constructs its own ad hoc shapes.

Consumers import via the package root (e.g.
`services/workspace/src/routes.ts:3-11`).

---

## 11. Discrepancies between `.cursor/rules/*.mdc` and code

| Rule claim                                                                       | Reality                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --------- |
| "No cross-service DB access — services talk over HTTP / Redis pub/sub / BullMQ." | Every service imports `@pcp/db` and reads/writes shared tables. Zero inter-service HTTP. (§3)                                                                                                                                                         |
| "Layering: repository (DB only) → service (logic) → route."                      | No service has a repository module. Drizzle calls live in service classes. (§4)                                                                                                                                                                       |
| "Every query must filter by `user_id` or `organization_id`."                     | Mostly observed via `validateUserFromCookie` + tenant-scoped `where`. Violations: `services/publish/src/service.ts:36` reads `userId` from request without session validation; `services/publish/src/routes.ts:13` accepts `userId` as a query param. |
| "Logging is pino JSON with `correlationId, userId, service`; no PII."            | Pino is used, but no `correlationId` is propagated (no request-id plugin). `services/auth/src/service.ts:25, 52` logs the user's email at info level.                                                                                                 |
| "Config via env, validated with Zod at startup."                                 | Only `packages/db/src/client.ts:7-12` does this. Other services use `process.env.X                                                                                                                                                                    |     | 'dummy'`. |
| "BullMQ" / "Redis pub/sub"                                                       | Installed in agent only; queue file exists but is never wired into `index.ts`. Redis container has no live consumer.                                                                                                                                  |
| README mentions "API at :4000" / `apps/api`.                                     | No such app exists; AGENTS.md already calls this stale.                                                                                                                                                                                               |
| `apps/web/src/proxy.ts` looks like Next middleware.                              | Not at `apps/web/src/middleware.ts`, so Next never invokes it. Auth gating is client-side only.                                                                                                                                                       |
| `tasks.conversation_id` "FK enforced application-side" (`tasks.ts:14`).          | Indeed not a real FK — orchestrator must guarantee it. There is no integrity check today.                                                                                                                                                             |
| Approval flow                                                                    | `requiresApproval` is hard-coded by tool name string in `services/agent/src/orchestrator.ts:215`, not driven by the `Tool.requiresApproval` field defined in the registry contract (`services/agent/src/tools/registry.ts:14`).                       |

---

## 12. Cross-cutting summary diagram

```
                               ┌────────────────────┐
                               │  apps/web (Next 16)│
                               │  axios + RQuery    │
                               └─────────┬──────────┘
                                         │ cookie: sessionId (httpOnly)
              ┌───────────┬──────────────┼──────────────┬─────────────┐
              ▼           ▼              ▼              ▼             ▼
        :3001 auth   :3002 workspace :3003 runtime  :3004 agent  :3005 memory  :3006 publish
        Fastify+Zod  Fastify+Zod    Fastify+Zod+WS Fastify+Zod   Fastify+Zod   Fastify+Zod
              │           │              │              │             │             │
              │           │              │              │             │             │
              │     putStream/getText    │              │             │       dockerode
              │           │              │              │             │       (host docker)
              │           ▼              │              │             │             │
              │      MinIO :9000         │              │             │             │
              │     (S3 path-style)      │              │             │             │
              │                          ▼              │             │             │
              │                   dockerode (host)      │             │             │
              │                                         │     (in-proc)│            │
              │                                         │   fire&forget│            │
              │                                         ▼             │             │
              │                                    LLM HTTP           │             │
              │                                  (OpenAI / Anthropic  │             │
              │                                  / MiniMax)           │             │
              │                                                       │             │
              │                                                       ▼             │
              │                                              OpenAI Embeddings      │
              │                                              (memory only)          │
              ▼                                                                    │
        Postgres 16 + pgvector  ◄─────  every service uses @pcp/db (shared DB IS the bus)
```

---

## 13. Where to read first

- New backend feature: `services/<svc>/src/{index,routes,service}.ts` — pattern
  is uniform; copy from `services/workspace/src/routes.ts:15` for an example
  with body/params/querystring schemas, response schemas, and tenant-scoped
  service calls.
- New table: add `packages/db/src/schema/<name>.ts`, re-export from
  `packages/db/src/schema/index.ts`, `pnpm --filter @pcp/db generate` to emit
  a migration, then `pnpm --filter @pcp/db migrate` to apply.
- New shared DTO: `packages/shared/src/<feature>.ts`, re-export from
  `packages/shared/src/index.ts` (do not forget — see automation.ts orphan).
- Front-end calls: extend `apps/web/src/lib/api.ts`; do not inline new axios
  clients per page.
- Async work: there is currently no harness for it. If you need queueing, the
  half-built BullMQ wiring lives at `services/agent/src/automation/queue.ts`
  and would need to be imported and started from `services/agent/src/index.ts`.

---

_End of architecture map._
