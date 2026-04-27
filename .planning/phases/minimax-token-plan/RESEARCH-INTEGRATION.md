# MiniMax Token Plan — Codebase Integration Points

**Researched:** 2026-04-26
**Scope:** Where a multi-modal MiniMax provider (text M2.7 + Speech 2.8 + image-01 + Hailuo + Music-2.6) plugs into the existing repo.
**Confidence:** HIGH for code that exists; LOW for "what's missing" claims (verified by `grep` on the working tree only — see `NOT FOUND:` markers).

> **Headline.** A skeleton MiniMax integration already exists for **text only** (it routes through the Anthropic SDK because MiniMax exposes an Anthropic-compatible endpoint at `https://api.minimax.io/anthropic`). Everything else — speech, image, video, music, BYOK key storage with encryption, quota tracking, modality picker, settings UX, frontend axios clients — is **not present in the repo**. Below is exactly what exists, where new code plugs in, and what is missing.

---

## 1. LLM Provider Layer

### 1.1 Existing interface

`services/agent/src/llm/types.ts:29-31`

```ts
export interface LLMProvider {
  generate(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse>;
}
```

`Message` (`types.ts:1-5`) is text-only — `role: 'system' | 'user' | 'assistant'`, `content: string`. **There is no notion of image/audio/video parts in this interface today.** The interface presumes a single round-trip `generate()`; **no streaming method, no async-job method.**

`LLMResponse` (`types.ts:19-27`) returns `content: string | null`, optional `toolCalls[]`, optional `usage` (`promptTokens/completionTokens/totalTokens`). No multi-modal output type, no `requestId` for async jobs.

### 1.2 Existing providers

| File                                       | Class               | Notes                                                                                                                                                             |
| ------------------------------------------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/agent/src/llm/openai.ts:4-56`    | `OpenAIProvider`    | Default model `gpt-4-turbo-preview`. No `baseURL` override.                                                                                                       |
| `services/agent/src/llm/anthropic.ts:4-61` | `AnthropicProvider` | Accepts `baseURL?` arg in constructor (`anthropic.ts:8`). Passes it through `new Anthropic({ apiKey, baseURL })`. **This is the actual MiniMax M2.7 path today.** |

There is **no** `mock` or `MockProvider` despite `provider_credentials.ts:25` listing `mock` as a known provider value. `NOT FOUND:` `services/agent/src/llm/mock.ts` does not exist (`ls services/agent/src/llm/` → `anthropic.ts`, `openai.ts`, `provider.ts`, `types.ts`).

### 1.3 Provider selection

`services/agent/src/llm/provider.ts:12-32` — `createLLMProvider(env)` is **purely env-driven**, NOT per-task or per-user. Selection logic:

```ts
// provider.ts:15-21
if (provider === 'minimax') {
  return new AnthropicProvider(
    env.MINIMAX_TOKEN_PLAN_API_KEY || env.MINIMAX_API_KEY || 'dummy_key',
    env.MINIMAX_MODEL || 'MiniMax-M2.7',
    env.MINIMAX_BASE_URL || 'https://api.minimax.io/anthropic',
  );
}
```

The orchestrator instantiates the provider **once at construction time** (`orchestrator.ts:14`: `this.llm = createLLMProvider();`). To switch providers per conversation/user/task, this needs refactoring — currently every task in the agent service uses the same env-pinned provider.

**Confirmed:** `infra/docker/.env.example` already has `LLM_PROVIDER=minimax`, `MINIMAX_TOKEN_PLAN_API_KEY=`, `MINIMAX_BASE_URL=https://api.minimax.io/anthropic`, `MINIMAX_MODEL=MiniMax-M2.7` defined. Operator-level wiring exists; user-level BYOK does not.

### 1.4 OpenAI-compatible base URL override?

**Partially.**

- `OpenAIProvider` (`openai.ts:8-9`) does **NOT** accept a `baseURL` override today: `new OpenAI({ apiKey })` only. To use MiniMax's OpenAI-compatible endpoint (e.g. `https://api.minimax.io/v1`) we would either:
  1. Add an optional `baseURL` arg to `OpenAIProvider` (one-line change), or
  2. Keep using `AnthropicProvider` with the `/anthropic` endpoint (current choice).
- `AnthropicProvider` already accepts `baseURL` and is the current MiniMax path.

### 1.5 Streaming & tool dispatch

- **Streaming:** Not implemented. `OpenAIProvider.generate` calls `chat.completions.create` without `stream: true` (`openai.ts:29-34`). `AnthropicProvider.generate` calls `messages.create` without streaming (`anthropic.ts:27-33`). No SSE plumbing in `routes.ts` either; `GET /agent/tasks/:id/steps` is poll-based only (`routes.ts:57-74`).
- **Tool dispatch:** Orchestrator only handles `response.toolCalls[0]` (`orchestrator.ts:117`) — silently drops parallel tool calls. Tool results are pushed back as `role: 'user'` (`orchestrator.ts:153-157`), which violates the OpenAI tool-calling spec (should be `role: 'tool'`) and the Anthropic spec (should be `tool_result` content block). This is a known existing bug, called out in `CONCERNS.md` L7 and `ARCH.md` §3.4.

### 1.6 Where a `MiniMaxProvider` plugs in

There are two viable shapes:

**Option A — Keep current routing, add MiniMax-specific provider class for non-Anthropic-compatible features.**
The text path stays on `AnthropicProvider` against `/anthropic`. A new `services/agent/src/llm/minimax.ts` would expose **only the modalities the Anthropic shim doesn't cover** (TTS/image/video/music — those use MiniMax's own REST API, not Anthropic-compatible). This keeps text fully working and isolates new code.

**Option B — Introduce a true `MiniMaxProvider` that implements an extended interface** (`generate`, `generateImage`, `generateSpeech`, `generateVideo`, `generateMusic`). Requires:

- Extending `LLMProvider` interface in `types.ts` with optional async-modality methods, OR
- A separate `MultiModalProvider` interface alongside `LLMProvider`.
- Refactoring `orchestrator.ts` provider selection to per-task BYOK lookup.

**Recommended split (decision needed from user — see §8):** keep `AnthropicProvider` for chat (already works), add a new sibling **service or module** for non-text modalities (see §4).

---

## 2. Provider Credential Storage

### 2.1 Current `provider_credentials` schema

`packages/db/src/schema/provider_credentials.ts:18-40`:

| Column         | Type        | Notes                                                                       |
| -------------- | ----------- | --------------------------------------------------------------------------- | --------- | ------ | ---------------------------------------------------------------------------------------- |
| `id`           | uuid PK     |                                                                             |
| `user_id`      | uuid FK     | tenant scoping ✅                                                           |
| `provider`     | varchar(32) | comment lists `openai                                                       | anthropic | google | mock`— **no`minimax` yet\*\* (line 25). String column, not enum, so values are advisory. |
| `label`        | varchar(80) | nullable user label — supports the "multiple keys per provider" use case ✅ |
| `encryptedKey` | text        | base64 AES-256-GCM ciphertext                                               |
| `iv`           | varchar(64) | base64                                                                      |
| `authTag`      | varchar(64) | base64                                                                      |
| `keyVersion`   | varchar(16) | default `'v1'` — for key rotation ✅                                        |
| `lastUsedAt`   | timestamp   | nullable                                                                    |
| `createdAt`    | timestamp   |                                                                             |
| `revokedAt`    | timestamp   | nullable — soft revoke ✅                                                   |
| `metadata`     | jsonb       | `Record<string, unknown>` — free-form extension point                       |

Indexes: `(user_id)` and `(user_id, provider, revoked_at)` — sufficient for "find all active keys for this user/provider".

### 2.2 Does it support what MiniMax needs?

| Requirement                                        | Current schema support         | Notes                                                                         |
| -------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------- | --------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| Multiple keys per provider (Token Plan + PAYG)     | ✅ via `label` + multiple rows | No uniqueness constraint; any user can have N keys with `provider='minimax'`. |
| Plan tier metadata (starter/plus/max/highspeed)    | ⚠️ via `metadata` jsonb only   | No first-class column. Recommended addition (see §2.3).                       |
| Plan expiry date                                   | ⚠️ via `metadata` jsonb only   | No first-class column.                                                        |
| Modalities enabled (text/speech/image/video/music) | ⚠️ via `metadata` jsonb only   |                                                                               |
| Quota counters (rolling windows)                   | ❌                             | Should NOT live here — see §3.                                                |
| `provider='minimax'` value                         | ⚠️                             | Currently the doc-comment lists `openai                                       | anthropic | google | mock`. No DB constraint, so adding `'minimax'` is a **0-migration code change**, but the comment should be updated. |

### 2.3 Recommended schema additions (DO NOT WRITE MIGRATIONS — propose only)

Either:

- **A. Use `metadata` jsonb with a typed shape.** Cheap. Define a TypeScript type:
  ```ts
  type MiniMaxCredentialMetadata = {
    planTier?: 'starter' | 'plus' | 'max' | 'highspeed';
    planType?: 'token' | 'payg';
    modalities?: Array<'text' | 'speech' | 'image' | 'video' | 'music'>;
    planExpiresAt?: string; // ISO
    isFallback?: boolean; // marks PAYG fallback key
  };
  ```
  Drizzle `.$type<...>()` is already in use; consumer code casts.
- **B. Add columns** (`plan_tier varchar(16)`, `plan_type varchar(8)`, `plan_expires_at timestamp`, `is_fallback boolean`, `modalities jsonb`). More queryable but requires a migration.

**Recommendation:** start with **A** (jsonb metadata) — no migration, no schema risk. Promote to columns only if we need to filter/sort by tier in SQL.

Other gaps:

- Comment `// openai|anthropic|google|mock` (`provider_credentials.ts:25`) should add `|minimax`. Trivial.
- No FK or check constraint on `provider` — fine, keep flexible.
- No `(user_id, provider, label)` unique index — allowed today; if "one Token Plan key + one PAYG key per user" needs to be enforced we'd add a partial unique index. Optional.

### 2.4 Encryption: gap

**The `encryptedKey/iv/authTag` columns assume an encryption layer that does not exist in code yet.** See §7. `ENCRYPTION_KEY` is documented in `.env.example:19` and referenced in the schema doc-comment, but `grep -rn "ENCRYPTION_KEY"` returns matches **only in schema doc-comments** — no service reads it, no encrypt/decrypt helpers exist. This is a hard prerequisite before any MiniMax key can be safely persisted.

---

## 3. Quota Tracking

### 3.1 Existing rate-limit / quota infrastructure

| Mechanism                   | Where                                                                           | Status                                                                                                                                                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@fastify/rate-limit`       | `services/auth/src/index.ts:5,30-33`; `services/workspace/package.json:17` only | Token-bucket per IP, in-memory by default. **NOT** wired in `agent`, `runtime`, `memory`, `publish`.                                                                                                                                                                       |
| Redis                       | `infra/docker/docker-compose.yml` defines `pcp-redis:6379`                      | **No service imports `ioredis`/`redis`/`bullmq`.** Container runs but is dead code (verified: `grep -rn "ioredis\|redis\|bullmq" services/ packages/ --include='*.ts' --include='*.json'` → 0 hits except `services/{auth,workspace}/package.json` `@fastify/rate-limit`). |
| BullMQ / job queue          | —                                                                               | **Not installed in any package.json. The agent loop is fire-and-forget in-process** (`orchestrator.ts:48-51`, also flagged in `CONCERNS.md` H10).                                                                                                                          |
| Storage quota               | `services/workspace/src/service.ts:285-286`                                     | Per-workspace bytes, enforced in SQL — model for "compare counter to limit". Not reusable for time-windowed quotas.                                                                                                                                                        |
| Per-provider usage counters | —                                                                               | `NOT FOUND:` no `provider_usage`, `usage_events`, `quota_*` table in `packages/db/src/schema/`. No code references usage tracking.                                                                                                                                         |

### 3.2 What MiniMax Token Plan needs

- **Text (M2.7):** 5h **rolling window** request count per user per Token Plan key.
- **Speech 2.8:** daily character cap.
- **image-01:** daily image cap.
- **Hailuo (video):** daily video cap.
- **Music-2.6:** daily song cap.
- All counters MUST be per-user (BYOK), not global, since each user supplies their own MiniMax key.
- Reads from quota counters happen on **every** chat/generation request → must be cheap (sub-ms).

### 3.3 Where it should live — options

| Option                                                                                  | Pros                                                                                                                                | Cons                                                                                                                                |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Redis sliding window** (preferred for the 5h rolling)                                 | Already in compose; canonical for sliding windows; sub-ms; cheap. Use `ZADD`/`ZREMRANGEBYSCORE` or `INCRBY` on a date-keyed bucket. | Requires adding `ioredis` to whatever service owns this — **net-new infra adoption** in this codebase.                              |
| **Postgres `provider_usage` table**                                                     | No new infra; auditable.                                                                                                            | Sliding-window counts require window-function queries on every request — slower under load; 5h granularity means high write volume. |
| **Hybrid:** Redis for live counters, Postgres `provider_usage_events` for audit/billing | Cleanest.                                                                                                                           | More moving parts.                                                                                                                  |

**Recommendation:** introduce a `services/agent/src/quota/` module (or a **new `packages/quota` shared package**, since usage tracking will also matter for image/video services) that:

1. Connects to Redis using `REDIS_URL` (already env-defined).
2. Exposes `checkAndIncrement(userId, modality, weight)` returning `{ allowed: boolean, remaining: number, resetsAt: Date }`.
3. Optionally double-writes a row to `provider_usage_events` for audit.
4. Schema (proposed):
   ```
   provider_usage_events (id, user_id, provider, modality, units_consumed,
                         token_plan_key_id?, created_at)
   ```

**Critical gap to flag:** no service today is on Redis. Adding Redis to `services/agent` is a **stack-level decision** (config validation, pool, error handling). It also retroactively unblocks BullMQ adoption (called out as the fix for `CONCERNS.md` H10).

---

## 4. Multi-modal Endpoints — Where do they belong?

### 4.1 Modality matrix

| Modality             | MiniMax product                       | Owning service today | Code present                                                                                                                  | What's missing                                                                                                                                           |
| -------------------- | ------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Text/chat**        | M2.7                                  | `services/agent`     | ✅ `POST /agent/tasks` (`agent/src/routes.ts:16-34`) routes to `AnthropicProvider` against `/anthropic` (`provider.ts:15-21`) | Per-user BYOK key resolution; quota check; streaming; conversation linking (new `conversations` table is unused — see `conversations.ts` and 4.4 below). |
| **Speech / TTS**     | Speech 2.8 (`speech-02-hd`, `T2A v2`) | None                 | `NOT FOUND:` no TTS route, no module, no shared schema                                                                        | Net-new endpoint. See 4.2.                                                                                                                               |
| **Image generation** | `image-01`                            | None                 | `NOT FOUND:` no image route                                                                                                   | Net-new endpoint.                                                                                                                                        |
| **Video generation** | Hailuo (`video-01`, async)            | None                 | `NOT FOUND:` no video route, no job queue                                                                                     | Net-new endpoint **+ async job infra**. See 4.3.                                                                                                         |
| **Music generation** | Music-2.6 (async)                     | None                 | `NOT FOUND:` no music route, no job queue                                                                                     | Net-new endpoint **+ async job infra**.                                                                                                                  |

### 4.2 Where TTS/image should live

The agent service is currently **chat-only**. Three architecturally consistent placements:

1. **Extend `services/agent`** — add `/agent/speech`, `/agent/images`. Keeps all "AI inference" in one service. Easy quota sharing. **Risk:** the agent service grows into a "god service" of model calls.
2. **New `services/media`** (or `services/inference`) — dedicated multi-modal service. Same Fastify pattern as the others, port `:3007`. Cleanest separation; mirrors the existing one-service-per-domain layout (`ARCH.md` §1).
3. **Per-modality services** — `services/speech`, `services/image`, etc. Overkill for an MVP.

**Recommended:** **option 2** (new `services/media`) for sync image+TTS, **and** option 1 for chat (already there). This matches the existing one-service-per-domain split and avoids cross-cutting modifications to the chat orchestrator.

### 4.3 Async jobs (video / music)

Hailuo video and Music-2.6 are async — submit a job, poll for completion (typical 30s–5min). The repo has **no job queue**:

- `bullmq` and `ioredis` are not in any `package.json`.
- `services/agent/src/orchestrator.ts:48-51` uses `Promise.catch` fire-and-forget with no persistence of in-flight state beyond the `tasks` table (`tasks.status`).
- The closest existing pattern is `tasks` + `task_steps` (`packages/db/src/schema/tasks.ts`, `task_steps.ts`) — but those are bound to chat tasks.

**Options:**

- **Reuse the `tasks` table polymorphically** by adding a `kind` column or storing media-job state in `metadata`. Cheap but pollutes the chat-task semantics.
- **New `media_jobs` table** + a worker. Clean.
- **Adopt BullMQ on Redis** — gives retries, exponential backoff, dead-letter, scheduled polling. **This is the right answer long-term.** Already noted as the fix for `CONCERNS.md` H10. Adding it for media jobs unblocks the agent fix too.

**Critical gap to flag:** **BullMQ is not installed.** Plan this as a separate workstream — adopting Redis + BullMQ touches stack-level concerns (env validation, graceful shutdown, retry semantics).

### 4.4 Frontend pages that would consume media

| Page                  | Path                                                                                             | Status                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Dashboard / chat home | `apps/web/src/app/(main)/dashboard/page.tsx` → `ChatHome` (`components/app-shell/chat-home.tsx`) | **Mocked**: response is hard-coded (`chat-home.tsx:8-9`); does not call `agentApi`. Modality picker absent. |
| Workspace chat        | `apps/web/src/components/workspace/chat.tsx:24-25`                                               | Calls `agentApi.post('/agent/tasks', ...)` for real. Text-only; no upload, no media buttons.                |
| Chats list            | `apps/web/src/app/(main)/chats/page.tsx`                                                         | Exists but `NOT INSPECTED in detail` — name suggests conversation list.                                     |
| Files                 | `(main)/files/page.tsx`                                                                          | Just `redirect('/workspaces')`.                                                                             |
| Datasets              | `(main)/datasets/page.tsx`                                                                       | `ModulePlaceholder` (beta, not wired).                                                                      |
| Computer              | `(main)/computer/page.tsx`                                                                       | `ModulePlaceholder`.                                                                                        |
| Space                 | `(main)/space/page.tsx`                                                                          | `ModulePlaceholder`.                                                                                        |
| Hosting               | `(main)/hosting/page.tsx`                                                                        | Real, calls `publishApi`.                                                                                   |

**There is no `/gallery`, `/media`, `/images`, `/audio`, or similar page.** Sidebar (`apps/web/src/components/app-shell/sidebar.tsx:35-52`) lists Home, Files, Chats, Automations, Space, Skills, Computer, Terminal, Hosting, Datasets, Bookmarks, Settings — **no media surface**.

A "Gallery" or "Media" page is net-new. The dashboard composer (`chat-composer.tsx`) is the most plausible attach point for inline image/audio generation since it already has `Plus`/`Paperclip` buttons (lines 59-71) and a `ModelSelector`, `PlanBadge` row (lines 53-57).

---

## 5. Frontend Integration Points

### 5.1 `apps/web/src/lib/api.ts` (37 lines total)

Defines four axios clients (`api.ts:10-28`):

- `authApi` → `:3001/auth`
- `workspaceApi` → `:3002/api`
- `agentApi` → `:3004/api`
- `publishApi` → `:3006/publish`

All carry `withCredentials: true`. No `memoryApi`, no `runtimeApi`, no `mediaApi`. To add MiniMax non-text endpoints we'd append:

```ts
export const mediaApi = axios.create({ baseURL: '...:3007/api', withCredentials: true });
```

or fold non-text routes into `agentApi` if option-1 from §4.2 is chosen.

The file also exports `getApiErrorMessage(error, fallback)` — that helper is the pattern to reuse.

### 5.2 Settings page

`apps/web/src/app/(main)/settings/page.tsx:8-69` is **client component**, mocked: profile form does nothing, OAuth integrations show dummy "Not connected" cards. **No section for AI provider keys.** A "Providers" or "AI Keys" section is the natural home for MiniMax key entry, plan tier display, and quota readout.

Required additions:

- `POST /auth/providers` (or new `/api/providers`) — store encrypted key, return label + masked preview.
- `GET /api/providers` — list active keys (never returns plaintext).
- `DELETE /api/providers/:id` — soft-revoke (`revokedAt`).

None of these endpoints exist yet (`NOT FOUND:` no provider routes in any service).

### 5.3 Dashboard / chat composer

`apps/web/src/components/app-shell/chat-composer.tsx:53-57` already renders:

```tsx
<PersonaSelector />
<ModelSelector />
<PlanBadge />
```

- **`ModelSelector`** (`model-selector.tsx`): displays a single model name from `process.env.NEXT_PUBLIC_DEFAULT_MODEL || 'MiniMax-M2.7'`. **Not interactive** — no dropdown, no state, no API call. Hardcoded MiniMax-M2.7 fallback already in place.
- **`PlanBadge`** (`plan-badge.tsx`): static label `process.env.NEXT_PUBLIC_PLAN_LABEL || 'Token Plan'`. **Not driven by user data.**
- **`PersonaSelector`**: not inspected in detail; backed by `personas` table (`provider_credentials.ts:60-78`) which is also not wired anywhere.

**There is no modality picker.** The composer has no UI for "generate image" / "generate audio" / "generate video". Adding one means adding a button group beside `ModelSelector` plus state in `ChatHome` (or a new `/media` page).

### 5.4 Workspace components

`apps/web/src/components/workspace/`:

- `chat.tsx` — text-only `agentApi` caller, no media handling (verified).
- `editor.tsx`, `file-tree.tsx`, `terminal.tsx`, `workspace-shell.tsx`, `create-workspace-dialog.tsx` — code/file editor surfaces. **No image previewer, no audio player, no video player.** The text-content preview in `workspace-service` (`service.ts:188-211`) caps at 256 KiB and rejects non-text MIMEs, so there is no infrastructure for displaying generated media inline.

---

## 6. Frontend Settings UX gaps

User wants subscription-aware UX:

- Plan tier (Starter / Plus / Max / Highspeed)
- Remaining quota per modality
- "Auto-fallback to PAYG when quota exhausted" toggle

**Current state — verified:**

- No quota readout anywhere in `apps/web/`. (`grep -rn "quota\|remaining\|usage" apps/web/src/` → only the existing `PlanBadge` static label.)
- No `/api/providers/quota` or equivalent endpoint exists in any service.
- `user_preferences` (`provider_credentials.ts:42-58`) has `defaultProvider`, `defaultModel`, `theme`, `terminalRiskLevel`, `bio`, `rules`, `notificationPrefs`. **No fallback toggle.** Adding `fallbackProvider varchar(32)` or extending `notificationPrefs` (or a new `providerPrefs` jsonb) would carry the auto-fallback flag.
- `PlanBadge` is purely cosmetic; it would need to read from a real source (`GET /api/providers/active` returning `{ planTier, modalities, ... }`).

**Net-new UI surface required:** entire "Subscription" or "AI Providers" panel inside `settings/page.tsx`. Backed by net-new `/api/providers` + `/api/providers/quota` endpoints.

---

## 7. Security — Encryption Gap

`CONCERNS.md` C5 already documents that `ENCRYPTION_KEY` is unused. Re-confirmed:

```
$ grep -rn "ENCRYPTION_KEY" services/ packages/ apps/ --include='*.ts'
packages/db/src/schema/notifications.ts:46  (column name, comment only)
packages/db/src/schema/provider_credentials.ts:15,27,29  (doc + columns, no usage)
```

**No service reads `process.env.ENCRYPTION_KEY`.** No crypto helper module exists. The `provider_credentials` schema **assumes** AES-256-GCM ciphertext (`encryptedKey`, `iv`, `authTag` columns) but no producer or consumer of those bytes is implemented.

### 7.1 What `packages/security/` (planned, not built) needs to provide

`NOT FOUND:` `packages/security/` does not exist (`ls packages/` → `db`, `shared`).

Minimum surface for MiniMax BYOK:

```ts
// packages/security/src/crypto.ts (proposed)
export function encryptSecret(plaintext: string): {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: string;
};
export function decryptSecret(blob: {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: string;
}): string;

// packages/security/src/env.ts (proposed)
export const securityEnv = z
  .object({
    ENCRYPTION_KEY: z
      .string()
      .regex(/^[A-Za-z0-9+/=]+$/)
      .refine((v) => Buffer.from(v, 'base64').length === 32, 'must decode to 32 bytes'),
    ENCRYPTION_KEY_VERSION: z.string().default('v1'),
  })
  .parse(process.env);
```

Implementation: Node's built-in `crypto.createCipheriv('aes-256-gcm', key, iv)`. Key derivation strategy (single static key vs. per-version map) is a separate decision — the schema's `keyVersion` column is forward-compatible.

**Hard prerequisite:** `packages/security/` must exist and be imported by whichever service writes/reads `provider_credentials` rows **before** any MiniMax key can be persisted. Storing keys plaintext or with a stub cipher would silently violate the schema's contract.

### 7.2 Other security touchpoints for MiniMax BYOK

- The settings page submits the key over HTTP; `services/auth` (the only home for user-scoped credentials today) has rate limit on `/login` and `/register` but no provider routes. New routes will need rate limits to prevent key-stuffing — `CONCERNS.md` H6 already flags rate limits missing outside auth.
- Logger redaction: `services/agent`'s pino instance does not redact tool errors (`CONCERNS.md` M9), so a MiniMax 401 with the key echoed back could end up in logs. Need pino `redact: ['*.apiKey', '*.authorization']` config on whatever service handles MiniMax responses.
- `provider_credentials.lastUsedAt` is a useful audit signal — should be updated on each successful provider call (cheap UPDATE). Not in scope for the cipher work but worth noting for the planner.

---

## 8. Open Questions for the User

These need answers before planning, in rough priority order:

1. **Sync vs CLI for video/music.** Do we shell out to MiniMax's `minimax` CLI for Hailuo/Music (faster path, fewer auth surfaces) or implement HTTP directly (more code, but no Node→Python boundary)? Affects whether we need BullMQ or just a polling endpoint.
2. **PAYG fallback default.** When Token Plan quota is exhausted: hard-fail, soft-fail with retry-after, or auto-fallback to a separately-stored PAYG key by default? "Opt-in via toggle" is the safe default but needs UX confirmation.
3. **Where do non-text modalities live?** New `services/media` (recommended) or fold into `services/agent`? This decision blocks the planner's task split.
4. **Adopt Redis + BullMQ now or defer?** Redis is in compose but unused. Adding ioredis introduces a stack-level dep across services. Required for clean 5h sliding window (text quota) and for video/music async jobs. If deferred, we get a Postgres-only quota layer (slower, more code) and fire-and-forget media jobs (worse than current chat).
5. **Per-user BYOK or operator-key for MVP?** The current code reads `MINIMAX_TOKEN_PLAN_API_KEY` from process env (operator-supplied, single tenant). Switching to per-user BYOK requires the encryption layer (§7) **and** refactoring `AgentOrchestrator` to resolve the key per task instead of at construction time (`orchestrator.ts:14`). MVP could ship operator-key first.
6. **Quota authority.** Is the MiniMax API's own quota response the source of truth, or do we maintain a parallel local counter? If MiniMax exposes remaining-quota headers, we should mirror those rather than count locally.
7. **Modality picker UX.** Inline buttons in `ChatComposer` (alongside `ModelSelector`) vs. a dedicated `/media` page? Current composer has no media affordances; adding them is small but conceptually distinct from a gallery surface.
8. **Conversation/task model for media.** Reuse `tasks`/`task_steps` (which now has `conversations` table waiting to link them) for image/video generation, or new `media_jobs`? Affects the existing tool-approval + step-streaming UX vs. a new one.

---

## 9. Reference Index (file:line)

**LLM provider layer:**

- `services/agent/src/llm/types.ts:1-31` — interface
- `services/agent/src/llm/openai.ts:8-9` — no baseURL override
- `services/agent/src/llm/anthropic.ts:8-9` — baseURL accepted (current MiniMax route)
- `services/agent/src/llm/provider.ts:7-21` — env-driven selection, MiniMax routed via Anthropic SDK
- `services/agent/src/orchestrator.ts:14` — provider instantiated once at construction
- `services/agent/src/orchestrator.ts:48-51` — fire-and-forget, no queue
- `services/agent/src/orchestrator.ts:117` — only first tool call dispatched
- `services/agent/src/orchestrator.ts:153-157` — wrong role for tool result

**Schema:**

- `packages/db/src/schema/provider_credentials.ts:18-40` — credential storage shape
- `packages/db/src/schema/provider_credentials.ts:25` — `provider` doc-comment lacks `minimax`
- `packages/db/src/schema/provider_credentials.ts:42-58` — `user_preferences` (no fallback toggle)
- `packages/db/src/schema/conversations.ts:9-31` — chat threading (unused by service code today)
- `packages/db/src/schema/tool_calls.ts:9-35` — structured tool call records (unused)
- `packages/db/src/schema/index.ts:14-22` — new schemas exported

**Frontend:**

- `apps/web/src/lib/api.ts:3-28` — axios client registry; no media client
- `apps/web/src/app/(main)/settings/page.tsx:1-69` — mocked profile + OAuth; no provider keys section
- `apps/web/src/app/(main)/dashboard/page.tsx:1-5` — renders `ChatHome`
- `apps/web/src/components/app-shell/chat-home.tsx:8-9` — mocked response, never calls API
- `apps/web/src/components/app-shell/chat-composer.tsx:53-57` — composer toolbar (PersonaSelector/ModelSelector/PlanBadge)
- `apps/web/src/components/app-shell/model-selector.tsx:6` — hardcoded `MiniMax-M2.7` fallback, non-interactive
- `apps/web/src/components/app-shell/plan-badge.tsx:3` — static `Token Plan` label
- `apps/web/src/components/workspace/chat.tsx:24-25` — only real call to `agentApi`
- `apps/web/src/components/app-shell/sidebar.tsx:35-52` — nav items (no media page)

**Infra / env:**

- `infra/docker/.env.example` lines around 19 — `ENCRYPTION_KEY`, `MINIMAX_*` already defined
- `infra/docker/docker-compose.yml` — `pcp-redis:6379` exists but unused by code

**Cross-references:**

- `.planning/codebase-map/CONCERNS.md` C5 — `ENCRYPTION_KEY` unused
- `.planning/codebase-map/CONCERNS.md` H6 — rate limits only on auth
- `.planning/codebase-map/CONCERNS.md` H10 — fire-and-forget agent loop, no queue
- `.planning/codebase-map/ARCH.md` §3.4 — agent service shape and known gaps
- `.planning/codebase-map/ARCH.md` §10 — aspirational vs implemented (no Redis, no BullMQ, no `organization_id`, no `repositories/` layer)

**Apps/web Next.js note:** any frontend wiring decisions in the planning phase MUST be cross-checked against `apps/web/node_modules/next/dist/docs/` before implementation — Next 16 + React 19 has breaking changes versus older patterns (per `apps/web/AGENTS.md`).

---

_Integration research: 2026-04-26. Working tree state: uncommitted schemas in `packages/db/src/schema/{provider_credentials,conversations,tool_calls,automations,hosted_services,snapshots,notifications,terminal,skills}.ts`. All file:line references verified at this snapshot._
