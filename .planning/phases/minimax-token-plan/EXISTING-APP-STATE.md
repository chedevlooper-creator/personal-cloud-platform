# EXISTING APP STATE — Pre-MiniMax Audit

**Date:** 2026-04-27
**Scope:** Ground-truth inventory of what is REAL, MOCK, STUB, or PLACEHOLDER in `personal-cloud-platform` before any MiniMax media features are designed. Every claim is anchored to `file:line`. No fabrication; gaps are marked `NOT FOUND`.

**Status legend (used throughout):**

- **REAL** — wired end-to-end (UI ↔ HTTP ↔ DB / external).
- **MOCK** — UI uses hardcoded data or fake responses; no backend call.
- **STUB** — backend route exists but returns canned data, swallows input, or is half-implemented.
- **PLACEHOLDER** — UI is just a "coming soon" / `<ModulePlaceholder/>` shell, no logic.
- **DECORATIVE** — element renders but has no `onClick` handler / no state mutation / no API call.

---

## 1. Frontend page inventory

All pages live under `apps/web/src/app/`. Group routes: `(main)` (authed shell) and `(auth)`. Root `page.tsx` is a redirect.

### Root + auth

| Route       | File                           | Status | Notes                                                                                                                   |
| ----------- | ------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| `/`         | `app/page.tsx`                 | REAL   | Redirects to `/dashboard` (server redirect).                                                                            |
| `/login`    | `app/(auth)/login/page.tsx`    | REAL   | `useLogin()` mutation → `authApi.post('/login')` (line 16, 20-27). Email + password only; no OAuth button on this page. |
| `/register` | `app/(auth)/register/page.tsx` | REAL   | `useRegister()` mutation → `authApi.post('/register')` (line 17, 21-28). Name+email+password.                           |

### `(main)/` shell

`(main)/layout.tsx` wraps everything in `AppShell` (sidebar + chat composer). Sidebar nav items defined in `components/app-shell/sidebar.tsx`.

| Route             | File                             | Status                  | Backend call(s)                                                                                                                                    | Mock data location                                                                                                                                                                                                                  |
| ----------------- | -------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard`      | `(main)/dashboard/page.tsx`      | REAL (chat single-shot) | `agentApi.post('/agent/chat')` via `chat-home.tsx:90-94`                                                                                           | —                                                                                                                                                                                                                                   |
| `/files`          | `(main)/files/page.tsx`          | REAL                    | Just redirects to `/workspaces`                                                                                                                    | —                                                                                                                                                                                                                                   |
| `/workspaces`     | `(main)/workspaces/page.tsx`     | REAL                    | `workspaceApi.get('/workspaces')` (line 21) and `POST /workspaces` for create                                                                      | —                                                                                                                                                                                                                                   |
| `/workspace/[id]` | `(main)/workspace/[id]/page.tsx` | REAL                    | Renders `<WorkspaceShell/>` which loads files via workspace service                                                                                | —                                                                                                                                                                                                                                   |
| `/apps`           | `(main)/apps/page.tsx`           | REAL                    | Redirects to `/hosting`                                                                                                                            | —                                                                                                                                                                                                                                   |
| `/hosting`        | `(main)/hosting/page.tsx`        | REAL (insecure)         | `publishApi.get/post/delete('/publish/...')` — passes `userId` from query/body (line 53, 71). Confirms `CONCERNS C1` (no auth on publish service). | —                                                                                                                                                                                                                                   |
| `/skills`         | `(main)/skills/page.tsx`         | **MOCK**                | None                                                                                                                                               | Hardcoded `skills` array `skills/page.tsx:17-46`; client-only filter.                                                                                                                                                               |
| `/settings`       | `(main)/settings/page.tsx`       | **MOCK**                | None                                                                                                                                               | Profile fields static (no `defaultValue` from `useUser()`); Save button has no `onClick`. OAuth Google/GitHub cards (lines vary): "Not connected" + Connect buttons are DECORATIVE. **No provider/API-keys section exists at all.** |
| `/chats`          | `(main)/chats/page.tsx`          | **PLACEHOLDER**         | None                                                                                                                                               | `<ModulePlaceholder/>` only.                                                                                                                                                                                                        |
| `/automations`    | `(main)/automations/page.tsx`    | **PLACEHOLDER**         | None                                                                                                                                               | `<ModulePlaceholder/>`.                                                                                                                                                                                                             |
| `/bookmarks`      | `(main)/bookmarks/page.tsx`      | **PLACEHOLDER**         | None                                                                                                                                               | `<ModulePlaceholder/>`.                                                                                                                                                                                                             |
| `/computer`       | `(main)/computer/page.tsx`       | **PLACEHOLDER**         | None                                                                                                                                               | `<ModulePlaceholder/>`.                                                                                                                                                                                                             |
| `/datasets`       | `(main)/datasets/page.tsx`       | **PLACEHOLDER**         | None                                                                                                                                               | `<ModulePlaceholder/>`.                                                                                                                                                                                                             |
| `/space`          | `(main)/space/page.tsx`          | **PLACEHOLDER**         | None                                                                                                                                               | `<ModulePlaceholder/>`.                                                                                                                                                                                                             |
| `/terminal`       | `(main)/terminal/page.tsx`       | **PLACEHOLDER**         | None                                                                                                                                               | `<ModulePlaceholder/>`. (Note: workspace shell has its own real terminal component; this top-level page is empty.)                                                                                                                  |

### Cruft / stale duplicates (committed but unused)

These files appear in `git ls-files` and reference the dead `NEXT_PUBLIC_API_URL=http://localhost:4000` (the README's stale gateway). Recommend deletion:

- `apps/web/src/app/(main)/dashboard/page 2.tsx`
- `apps/web/src/app/(main)/dashboard/page 3.tsx`
- `apps/web/src/app/(main)/apps/page 2.tsx`
- `apps/web/src/app/(main)/workspace/[id]/page 2.tsx`
- `apps/web/src/app/(main)/layout 2.tsx`
- `apps/web/src/lib/auth 2.ts`
- `apps/web/src/components/workspace/editor 2.tsx`
- `apps/web/src/components/workspace/file-tree 2.tsx`
- `services/workspace/src/service 2.ts`
- `services/workspace/src/service.test 2.ts`

### Sidebar nav surface

`components/app-shell/sidebar.tsx` lists: Dashboard, Chats, Workspaces, Hosting, Apps, Automations, Bookmarks, Computer, Datasets, Skills, Space, Terminal, Settings. **No media surface** (Images, Audio, Video, Music) exists in the nav — there is no UI entry point for any media-generation feature today.

---

## 2. Existing MiniMax-related code

Full grep across `services/`, `apps/web/src/`, `packages/`, `infra/` for `minimax|MiniMax|MINIMAX`:

| File:line                                                | Snippet                                                                                                                                                                        | Category                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `services/agent/src/llm/provider.ts:7`                   | `const DEFAULT_MINIMAX_MODEL = 'MiniMax-M2.7';`                                                                                                                                | **Wired** (used as fallback in factory)              |
| `services/agent/src/llm/provider.ts:8`                   | `const DEFAULT_MINIMAX_BASE_URL = 'https://api.minimax.io/anthropic';`                                                                                                         | **Wired**                                            |
| `services/agent/src/llm/provider.ts:10`                  | `export type LLMProviderName = 'openai' \| 'anthropic' \| 'minimax';`                                                                                                          | **Wired** (type)                                     |
| `services/agent/src/llm/provider.ts:15-21`               | Factory branch: when `provider === 'minimax'`, instantiates `AnthropicProvider` against `MINIMAX_BASE_URL` with `MINIMAX_TOKEN_PLAN_API_KEY` (falls back to `MINIMAX_API_KEY`) | **Wired**                                            |
| `services/agent/src/orchestrator.test.ts:18-22`          | Test asserts MiniMax provider initializes from env                                                                                                                             | **Wired** (test)                                     |
| `apps/web/src/components/app-shell/model-selector.tsx:6` | `model = process.env.NEXT_PUBLIC_DEFAULT_MODEL \|\| 'MiniMax-M2.7'`                                                                                                            | **Display-only** (no dropdown, button is decorative) |
| `apps/web/src/components/app-shell/plan-badge.tsx:3`     | Default label `'Token Plan'` (env-overridable)                                                                                                                                 | **Display-only**                                     |
| `apps/web/src/components/app-shell/chat-home.tsx:107`    | Error string: `'The MiniMax agent service is not available.'`                                                                                                                  | **Display-only**                                     |
| `infra/docker/.env.example`                              | `LLM_PROVIDER=minimax`, `MINIMAX_TOKEN_PLAN_API_KEY=`, `MINIMAX_BASE_URL=https://api.minimax.io/anthropic`, `MINIMAX_MODEL=MiniMax-M2.7`                                       | **Config**                                           |

**Summary:** MiniMax is wired ONLY as the LLM chat provider via the `/anthropic` Anthropic-compatible endpoint. There is **no code referencing** Hailuo, `image-01`, `speech-02`, `t2a`, `t2v`, `music`, `video-01`, or any other MiniMax media model.

---

## 3. Existing media / multimodal code

Grep for `image|tts|speech|audio|video|hailuo|t2a|t2v|multimodal` across `services/` and `apps/web/src/`:

| File                                                                                                                                                        | Hit                                                 | Real media code?                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------- |
| `apps/web/src/proxy.ts:25`                                                                                                                                  | `_next/image` in middleware matcher                 | NO — Next.js static asset path              |
| `services/runtime/src/service.ts:31,35,43`                                                                                                                  | `image: string` arg / `provider.create(image, ...)` | NO — Docker container image string          |
| `services/runtime/src/provider/docker.ts`, `services/runtime/src/provider/types.ts`, `packages/db/src/schema/runtimes.ts`, `packages/shared/src/runtime.ts` | `image` field                                       | NO — Docker image                           |
| `services/publish/src/service.ts:72`                                                                                                                        | `// nginx image and mount a dummy volume`           | NO — comment about nginx Docker image       |
| `packages/db/src/migrations/*`                                                                                                                              | `image` columns                                     | NO — Docker image columns on runtimes table |
| `services/workspace/src/service.test.ts`                                                                                                                    | `image` (test fixture for runtime)                  | NO                                          |

**Result: NOT FOUND.** Zero media-generation code anywhere in the codebase. No TTS, image, video, or music routes; no DB schema; no UI; no provider clients (`@google-cloud/text-to-speech`, `openai` `images.generate`, `replicate`, etc. — none installed).

---

## 4. Upload / file handling

### Workspace service routes (`services/workspace/src/routes.ts`)

| Method   | Path                            | Purpose                                           | Multipart? |
| -------- | ------------------------------- | ------------------------------------------------- | ---------- |
| `POST`   | `/workspaces`                   | Create workspace row                              | No         |
| `GET`    | `/workspaces`                   | List user workspaces                              | —          |
| `GET`    | `/workspaces/:id`               | Fetch one                                         | —          |
| `DELETE` | `/workspaces/:id`               | Delete                                            | —          |
| `GET`    | `/workspaces/:id/files`         | List file metadata                                | —          |
| `GET`    | `/workspaces/:id/files/content` | Get content (query path)                          | —          |
| `GET`    | `/workspaces/:id/files/*path`   | Get content (path param)                          | —          |
| `POST`   | `/workspaces/:id/files`         | **Create file row from JSON `{ path, content }`** | **No**     |
| `POST`   | `/workspaces/:id/directories`   | Create directory                                  | —          |
| `DELETE` | `/workspaces/:id/files/*path`   | Delete file                                       | —          |
| `POST`   | `/workspaces/:id/files/move`    | Rename / move                                     | —          |

### Multipart status

- `services/workspace/package.json:16` declares `"@fastify/multipart": "^8.1.0"` as a dependency.
- `services/workspace/src/index.ts` registrations (lines 22, 27, 36): `cors`, `cookie`, `setupWorkspaceRoutes`. **No `register(multipart, ...)`** — the dep is installed but never wired.
- No service registers `@fastify/multipart` (verified across all six `services/*/src/index.ts`).

**Conclusion:** There is no multipart/form-data upload endpoint anywhere. The closest thing is JSON `POST /workspaces/:id/files` which accepts text content only.

### Frontend upload UI

| Location                                              | Behavior                                          | Status                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `apps/web/src/components/app-shell/chat-composer.tsx` | `Plus` / `Paperclip` button calls `onUpload` prop | **DECORATIVE** — no parent passes a real handler that hits an API                              |
| `apps/web/src/components/app-shell/chat-home.tsx:124` | Hidden `<input type="file" />` element            | **DECORATIVE** — `onChange` does not call any `workspaceApi` upload route (none exists anyway) |
| `apps/web/src/components/workspace/*`                 | File tree, editor                                 | View / edit only — no upload from disk into MinIO                                              |

There is no drag-drop zone, no `FormData` construction, no `fetch` with `Content-Type: multipart/form-data` anywhere in the frontend.

---

## 5. Chat infrastructure

### Backend — `services/agent/`

**`services/agent/src/routes.ts`** (no SSE, no WebSocket, no streaming):

- `POST /agent/chat` (line ~26) — single-shot. Calls `runOrchestrator(...)` and awaits final assistant message. Returns `{ content, conversationId }`.
- `POST /agent/tasks` — creates a task row, kicks off `runAgentLoop` fire-and-forget.
- `GET /agent/tasks/:id` — fetch task row.
- `GET /agent/tasks/:id/steps` — fetch step rows (would be the polling endpoint).
- `POST /agent/tasks/:id/cancel` — flips status.
- `routes.ts:12` — dev shortcut `if (process.env.AUTH_BYPASS === '1') { userId = 'dev-user'; }`.

**`services/agent/src/orchestrator.ts`** (full read):

- Builds a system prompt + history, calls `provider.complete(messages, tools)`.
- Tool registry registers **only `ReadFileTool`** (line ~40). No write/exec/search/web/upload tools.
- `runAgentLoop` (line 48) is `void` — fire-and-forget, no await, no progress callback to client.
- Tool-call handling (line ~128): processes only `toolCalls[0]` — additional tool calls in the same response are dropped.
- After tool execution (line ~165): appends result with `role: 'user'` instead of `role: 'tool'`. This breaks Anthropic's tool-use contract and confuses the model on subsequent turns. (Documented in `CONCERNS.md`.)
- No streaming back to caller; the HTTP response only resolves after the entire loop terminates (or hits max-iterations).

**Transport:** plain HTTP request/response. No `@fastify/websocket` registered in agent service. No SSE writer. The runtime service IS the only one that registers `websocket` (`services/runtime/src/index.ts:33`) — used for terminal sessions, not chat.

### Frontend — chat affordances

**`apps/web/src/components/app-shell/chat-home.tsx`** (dashboard chat):

- `agentApi.post('/agent/chat', { messages, conversationId })` (lines 90-94). REAL but blocking — UI shows pending spinner until full reply arrives.
- `AbortController` is used for an Esc-to-stop affordance (works client-side only; server keeps running).
- Tool-approval card (`tool-approval-card.tsx`) is **shown via a regex match on the user's typed prompt** (`/file|deploy|publish|.../i`, line ~73). It is **not** triggered by a real tool-call event from the backend. The "Approve / Deny" buttons do not gate any backend execution — they just dismiss the card. **Fully DECORATIVE.**
- `chat-home.tsx:124` hidden file input — DECORATIVE (see §4).

**`apps/web/src/components/workspace/chat.tsx`** (workspace pane chat):

- `agentApi.post('/agent/tasks', ...)` (line ~25) — kicks off async task.
- After receiving the task id, displays a static `"Task X is pending"` message.
- **Never polls** `GET /agent/tasks/:id` or `/steps`. The user has no way to see progress, completion, or errors short of refreshing.

**`chat-composer.tsx`:**

- `PersonaSelector`, `ModelSelector`, `PlanBadge` — buttons render styled labels but have **no dropdown menus, no state setters, no API**. All DECORATIVE. The selected model is purely the env-default `MiniMax-M2.7`.
- `Send` button — REAL.
- `Paperclip` / `Plus` (upload) — DECORATIVE.
- Voice / record — NOT FOUND (no mic affordance).

**Verdict:** Chat is request/response only. There is no streaming, no SSE, no WebSocket, no token-by-token rendering, no task-progress polling. The "agent" UX is a thin wrapper over a single HTTP call.

---

## 6. Settings UX (`apps/web/src/app/(main)/settings/page.tsx`, 69 lines)

| Section (visible)       | Behavior                                                                                                                                         | Status     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| **Profile**             | Hardcoded fields (name, email). Inputs are uncontrolled / no `defaultValue` from `useUser()`. "Save changes" button has no `onClick`.            | MOCK       |
| **OAuth — Google**      | Card displays "Not connected". `Connect` button has no handler — does not call `/auth/oauth/google`.                                             | DECORATIVE |
| **OAuth — GitHub**      | Same as Google — `Connect` button is dead. (And no GitHub OAuth plugin is registered in `services/auth/src/routes.ts` — only Google at line 12.) | DECORATIVE |
| **Provider / API-keys** | **Does not exist.** No section, no schema, no DB column, no encrypted-secret store.                                                              | NOT FOUND  |
| **Theme / preferences** | Not present.                                                                                                                                     | NOT FOUND  |
| **Plan / billing**      | Not present.                                                                                                                                     | NOT FOUND  |

There is **no "connect external service" pattern** in the codebase. Users cannot supply their own MiniMax key (or any other key) through the UI. All keys are set via `infra/docker/.env` at deploy time. The DB schema has no `user_credentials` / `provider_keys` table.

This is a critical gap for any user-facing media-generation feature that needs to bill, rate-limit, or use a per-user API key.

---

## 7. Infra wiring — what compose services are actually USED by code

`infra/docker/docker-compose.yml` defines: Postgres (pgvector pg16), Redis 7, MinIO, Mailhog, Traefik.

| Compose service         | Used by code? | Evidence                                                                                                                                                                                                                                                                       |
| ----------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Postgres (pgvector)** | YES           | `packages/db/src/index.ts` connects via `DATABASE_URL`; every service imports `@pcp/db`. pgvector extension required by `services/memory` (embeddings).                                                                                                                        |
| **MinIO (S3)**          | YES           | `services/workspace/src/service.ts:32-39` instantiates `@aws-sdk/client-s3` against `S3_ENDPOINT` with `S3_ACCESS_KEY` / `S3_SECRET_KEY`. Workspace file content for binary/large files goes here. (Note: small text files appear to be stored in the `files` table directly.) |
| **Redis**               | **NO — DEAD** | `rg "ioredis\|bullmq" services/ apps/web/ packages/` returns zero results. No package.json declares either dep. Redis container starts but nothing connects.                                                                                                                   |
| **Mailhog**             | **NO — DEAD** | `SMTP_HOST` / `SMTP_PORT` are declared in `.env.example` but `process.env.SMTP_*` is never read in any service. No nodemailer / smtp client installed.                                                                                                                         |
| **Traefik**             | PARTIAL       | Used implicitly: `services/publish/src/service.ts` writes Traefik labels onto spawned Docker containers so user-published apps get auto-routed. Not used by the platform's own services (those are exposed via direct ports during dev).                                       |

**BullMQ / queue infrastructure: NOT INSTALLED.** Any "background job" today is JS-side fire-and-forget (`runAgentLoop` in agent service). No durability, no retry, no fan-out worker — confirmed via dependency grep.

---

## 8. Auth flow end-to-end

### Frontend

1. `apps/web/src/lib/auth.ts` exports `useUser`, `useLogin`, `useRegister`, `useLogout`.
   - `useUser()` → `authApi.get('/me')` (returns `{ user }` or 401).
   - `useLogin()` → `authApi.post('/login', { email, password })`.
   - `useRegister()` → `authApi.post('/register', { email, password, name })`.
   - `useLogout()` → `authApi.post('/logout')`.
2. `apps/web/src/lib/api.ts` — axios instances for `auth`, `workspace`, `agent`, `publish`, all with `withCredentials: true` (so the `sessionId` cookie is sent cross-origin).
3. `apps/web/src/proxy.ts` (26 lines):
   - Exports `proxy(request)` and a Next.js-style `config.matcher`.
   - Logic: if `AUTH_BYPASS=1` → pass through. Otherwise, redirect unauthed users (no `sessionId` cookie) to `/login`, and redirect authed users away from `/login` `/register` to `/dashboard`.
   - **CRITICAL: this file is NOT named `middleware.ts` and does NOT export `middleware`. Next.js will not pick it up.** ARCH.md's claim of middleware-based redirect is wrong. The redirect today happens only via `(auth)` page-level effects + the home `page.tsx` redirect.

### Backend — `services/auth/src/`

- `services/auth/src/routes.ts:12` — `oauthPlugin` registered for Google only (callback at `routes.ts:174`).
- Endpoints under `/auth` prefix:
  - `POST /auth/register` (line 26)
  - `POST /auth/login` (line 64)
  - `GET /auth/me` (line 101)
  - `POST /auth/logout` (line 125)
  - `POST /auth/...` (line 156 — likely refresh or password)
  - `GET /auth/oauth/google/callback` (line 174)
- Sessions stored in DB (`sessions` table); `sessionId` cookie is httpOnly + signed with `COOKIE_SECRET`.

### Cross-service validation

Each downstream service (`workspace`, `agent`, `runtime`, `memory`) re-implements `validateUserFromCookie(request)` locally — it reads `request.cookies.sessionId` and queries the DB sessions table directly. **Duplicated 4×** (CONCERNS.md tech-debt). The `publish` service skips this entirely and accepts `userId` from request body/query (CONCERNS C1 — vulnerable).

### Dev bypass

- `services/agent/src/routes.ts:12` — `AUTH_BYPASS=1` → use `userId = 'dev-user'`. Same pattern in workspace/runtime/memory (per ARCH.md).
- `apps/web/src/proxy.ts:5` — frontend-side bypass.

---

## 9. Half-built features

| Feature                                                                                       | Severity     | Evidence                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chat tool-execution loop**                                                                  | **HIGH**     | `orchestrator.ts:128` only handles first tool-call; `:165` uses wrong role. Only `ReadFileTool` registered. Multi-turn agent UX is broken.                                                                       |
| **Frontend `proxy.ts` (auth gate)**                                                           | **HIGH**     | File is misnamed; Next.js never invokes it. All authed routes are reachable without a session if a user knows the URL. (DB-side it's still safe because services check cookies — but the redirect UX is broken.) |
| **Publish service auth**                                                                      | **HIGH**     | `userId` from body/query (`hosting/page.tsx:53,71`). Any user can manage another's deployments.                                                                                                                  |
| **Workspace chat task progress**                                                              | **HIGH**     | `workspace/chat.tsx` posts task then never polls. User sees "pending" forever.                                                                                                                                   |
| **Multipart file upload**                                                                     | **HIGH**     | Dep installed (`workspace/package.json:16`) but plugin not registered; no route; no UI. Blocks any media-generation roadmap that needs reference images / audio.                                                 |
| **Tool-approval card**                                                                        | **MED**      | `chat-home.tsx:73` regex on user prompt drives a fake approval gate; not connected to backend.                                                                                                                   |
| **Settings page**                                                                             | **MED**      | All controls dead; no API-keys section.                                                                                                                                                                          |
| **OAuth — GitHub**                                                                            | **MED**      | UI present, server plugin absent.                                                                                                                                                                                |
| **Sidebar placeholders (chats, automations, bookmarks, computer, datasets, space, terminal)** | **MED**      | 7 nav items lead to `<ModulePlaceholder/>`. Discoverability suggests features exist.                                                                                                                             |
| **Skills page**                                                                               | **MED**      | Hardcoded list; no DB; no install/run mechanism.                                                                                                                                                                 |
| **Redis container**                                                                           | **MED**      | Running but unused. Wastes resources; misleading to contributors.                                                                                                                                                |
| **Mailhog / SMTP**                                                                            | **MED**      | Env declared, never read. No transactional email. Password-reset / verification cannot work.                                                                                                                     |
| **BullMQ / job queue**                                                                        | **MED**      | Not installed. All "async" work is in-process fire-and-forget — lost on restart.                                                                                                                                 |
| **`SESSION_SECRET` env**                                                                      | **LOW**      | Declared in `.env.example` but services use `COOKIE_SECRET`. Confusing.                                                                                                                                          |
| **`ENCRYPTION_KEY` env**                                                                      | **LOW**      | Declared, only mentioned in schema doc-comments; not used at runtime — but **needed** to support per-user API keys.                                                                                              |
| **`API_URL` (port 4000) env**                                                                 | **LOW**      | References a gateway that does not exist. README is stale.                                                                                                                                                       |
| **Stale duplicate files (`* 2.tsx`, `* 3.tsx`)**                                              | **LOW**      | 10+ files committed; reference dead env. See §1 cruft list.                                                                                                                                                      |
| **Token-streaming chat**                                                                      | **LOW** (UX) | No SSE / WS in agent. All chat is blocking.                                                                                                                                                                      |

---

## 10. Environment variables — declared vs read

### Declared in `infra/docker/.env.example`

`DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `REDIS_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `SESSION_SECRET`, `ENCRYPTION_KEY`, `SMTP_HOST`, `SMTP_PORT`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `LLM_PROVIDER`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY`, `MINIMAX_TOKEN_PLAN_API_KEY`, `MINIMAX_BASE_URL`, `MINIMAX_MODEL`, `API_URL`, `NEXT_PUBLIC_AUTH_API_URL`, `NEXT_PUBLIC_WORKSPACE_API_URL`, `NEXT_PUBLIC_AGENT_API_URL`, `NEXT_PUBLIC_PUBLISH_API_URL`, `NEXT_PUBLIC_DEFAULT_MODEL`, `NEXT_PUBLIC_PLAN_LABEL`, `NEXT_PUBLIC_API_URL`.

### Declared but never read (DEAD)

| Var                      | Reason                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET`         | Code reads `COOKIE_SECRET` instead.                                                                                                       |
| `ENCRYPTION_KEY`         | Only appears in schema doc-comments.                                                                                                      |
| `SMTP_HOST`, `SMTP_PORT` | No mailer code.                                                                                                                           |
| `ANTHROPIC_API_KEY`      | `provider.ts` reads only `MINIMAX_TOKEN_PLAN_API_KEY` / `MINIMAX_API_KEY`; no path constructs an Anthropic-direct provider with this key. |
| `GOOGLE_AI_API_KEY`      | No Gemini provider implementation exists.                                                                                                 |
| `API_URL`                | Points to dead port-4000 gateway; no service binds it; only the stale duplicate `* 2.tsx` files reference it.                             |
| `REDIS_URL`              | No `ioredis` / `bullmq` installed.                                                                                                        |
| `GOOGLE_REDIRECT_URI`    | Code reads `GOOGLE_CALLBACK_URL` (name mismatch — the OAuth callback will fail unless deployer sets both, see below).                     |

### Read in code but NOT declared in `.env.example` (UNDECLARED)

| Var                   | Read at                                                                                       | Notes                                                           |
| --------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `COOKIE_SECRET`       | All `services/*/src/index.ts` cookie registration                                             | Deployer must guess.                                            |
| `GOOGLE_CALLBACK_URL` | `services/auth/src/routes.ts` (oauth plugin config)                                           | Mismatched with `.env.example`'s `GOOGLE_REDIRECT_URI`.         |
| `FRONTEND_URL`        | OAuth redirect / CORS                                                                         | Used for post-OAuth redirect target.                            |
| `AUTH_BYPASS`         | All services + `apps/web/src/proxy.ts:5`                                                      | Dev-only flag.                                                  |
| `PORT`                | All services `index.ts`                                                                       | Each service has its own default.                               |
| `NODE_ENV`            | Various                                                                                       | Standard.                                                       |
| `MINIMAX_API_KEY`     | `services/agent/src/llm/provider.ts:15-21` (fallback when `MINIMAX_TOKEN_PLAN_API_KEY` unset) | Either name works; `.env.example` only documents the long form. |
| `DB_MAX_CONNECTIONS`  | `packages/db/src/index.ts`                                                                    | Pool tuning.                                                    |

### Recommended `.env.example` additions

For sanity, add: `COOKIE_SECRET`, `GOOGLE_CALLBACK_URL` (rename from `GOOGLE_REDIRECT_URI`), `FRONTEND_URL`, `AUTH_BYPASS`, `MINIMAX_API_KEY` (alias note). Remove: `SESSION_SECRET`, `API_URL`, and (for now) `REDIS_URL`, `SMTP_HOST`, `SMTP_PORT`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY` until the corresponding code is written.

---

## Appendix — Top-level constraints for the MiniMax media plan

Translating this audit into hard prerequisites for any media-generation phase:

1. **No upload pipeline exists.** Any feature requiring user-supplied images/audio must first wire `@fastify/multipart` in workspace service + a frontend upload component. (See §4.)
2. **No streaming / progress channel exists.** Long-running media jobs (image, video, music) need either polling on a `media_jobs` table or a real SSE/WS layer added to the agent service. (See §5, §7.)
3. **No queue infrastructure exists.** Background generation jobs cannot be made durable today. Either add BullMQ + Redis usage (Redis container is already up) or accept fire-and-forget for v1. (See §7.)
4. **No per-user API-key store exists.** All API calls are deployer-keyed. If MiniMax keys are to be user-supplied (for billing isolation), a `user_credentials` table + Settings UI section + `ENCRYPTION_KEY` actually used must be added. (See §6, §10.)
5. **No media surface in the UI.** Sidebar has no Images/Audio/Video/Music entries; no `(main)/<media>/page.tsx` exists. (See §1.)
6. **`apps/web/src/proxy.ts` is dead code.** Rename to `middleware.ts` or recreate as `middleware.ts` per Next.js 16 docs in `apps/web/node_modules/next/dist/docs/` before relying on it for media-feature gating.
7. **MiniMax integration today is chat-only via an Anthropic-shaped endpoint.** The native MiniMax media APIs (Hailuo image-01, speech-02, music, t2v) require a different base URL and request shape — none of that code exists. (See §2.)

— END —
