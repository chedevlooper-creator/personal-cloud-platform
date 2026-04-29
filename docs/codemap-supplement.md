# CloudMind OS Codemap Supplement — Eksik Trace'ler

Bu doküman, mevcut codemap'te yer almayan kritik servis akışlarını ve güvenlik derinlemesine incelemelerini içerir.

---

## Trace 8: Publish Service — App Hosting & Container Lifecycle

**Description:** Publish service — Kullanıcının workspace dosyalarını Docker container'da host etme, Traefik routing, env encryption, health monitoring ve auto-restart.

```text
Publish Service - App Hosting Flow
├── HTTP Layer
│   └── POST /publish/hosted-services endpoint <-- 8a
│       └── Zod schema validation (createHostedServiceSchema) <-- routes.ts:36
│           └── publishService.createService() call
├── Service Layer (PublishService)
│   ├── assertWorkspaceOwned() <-- 8b
│   │   └── workspace ownership + not-deleted check <-- service.ts:258
│   ├── normalizeSlug() validation (SLUG_PATTERN) <-- 8c
│   ├── normalizeRootPath() validation (no .., \0, ~) <-- 8d
│   ├── encryptEnvVars() — AES-256-GCM <-- 8e
│   │   └── encryption.ts:14 (enc:<iv>.<authTag>.<ciphertext>)
│   ├── db.insert(hostedServices) — status: 'stopped' <-- 8f
│   └── Audit log emit (HOSTED_SERVICE_CREATE) <-- 8g
│
├── Container Start Flow
│   └── POST /publish/hosted-services/:id/start <-- 8h
│       └── publishService.startService() <-- service.ts:107
│           ├── DB status → 'starting' (async) <-- service.ts:116
│           └── runContainer() — background Docker creation <-- 8i
│               ├── resolvePublishImage() — image allowlist <-- policy.ts:23
│               │   └── PUBLISH_IMAGE_ALLOWLIST: node:20-alpine, nginxinc/nginx-unprivileged:alpine
│               ├── docker.createContainer() with tenant labels <-- 8j
│               │   ├── Labels: traefik.http.routers.*.rule = Host(`slug.apps.localhost`) <-- service.ts:194
│               │   ├── HostConfig.Binds: /tmp/workspaces/{userId}/{workspaceId}:/workspace:ro <-- service.ts:200
│               │   ├── Security: CapDrop ALL, ReadonlyRootfs, no-new-privileges <-- 8k
│               │   ├── Resource limits: 512MB RAM, 1 CPU, 100 PidsLimit <-- service.ts:201-209
│               │   └── buildPublishSecurityOptions() — seccomp/apparmor <-- policy.ts:35
│               ├── Env: decryptEnvVars() + toSafeEnv() whitelist <-- 8l
│               └── docker.start() → DB status 'running', publicUrl set <-- service.ts:222
│
├── Health Daemon & Auto-Restart <-- 8m
│   └── startHealthDaemon() — 30s interval <-- health.ts:56
│       ├── runHealthCheck() — all 'running' services <-- health.ts:84
│       │   └── pingUrl(publicUrl) — 5s timeout, 5xx = fail <-- health.ts:38
│       │   └── 3 consecutive failures → markCrashed() <-- health.ts:147
│       │       ├── DB status → 'crashed', crashCount++ <-- health.ts:159
│       │       ├── hostedServiceLogs insert (system stream) <-- health.ts:162
│       │       └── notifications insert (severity: error) <-- health.ts:168
│       └── attemptRestart() — if autoRestart=true <-- health.ts:179
│           ├── Rate limit: max 5 restarts/hour <-- health.ts:192
│           ├── Backoff: 10s, 30s, 2m, 10m, 10m <-- health.ts:10
│           └── publishService.startService() dispatch <-- health.ts:213
│
└── Stop / Delete Flow
    └── POST /publish/hosted-services/:id/stop <-- 8n
        ├── docker.getContainer().stop().remove() <-- service.ts:137
        └── DB status → 'stopped', runnerProcessId = null <-- service.ts:146
    └── DELETE /publish/hosted-services/:id <-- 8o
        ├── stopService() (best effort) <-- service.ts:251
        └── db.delete(hostedServices) — tenant scoped <-- service.ts:253
```

**Location ID: 8a** — Create hosted service endpoint. Path: `services/publish/src/routes.ts:36`  
**Location ID: 8b** — Workspace ownership assertion. Path: `services/publish/src/service.ts:258`  
**Location ID: 8c** — Slug normalization & validation. Path: `services/publish/src/service.ts:283`  
**Location ID: 8d** — Root path traversal prevention. Path: `services/publish/src/service.ts:292`  
**Location ID: 8e** — AES-256-GCM env var encryption. Path: `services/publish/src/encryption.ts:14`  
**Location ID: 8f** — Hosted service DB insert. Path: `services/publish/src/service.ts:53`  
**Location ID: 8g** — Audit log emission. Path: `services/publish/src/service.ts:72`  
**Location ID: 8h** — Start service endpoint. Path: `services/publish/src/routes.ts:111`  
**Location ID: 8i** — Async container runner. Path: `services/publish/src/service.ts:122`  
**Location ID: 8j** — Docker container creation with Traefik labels. Path: `services/publish/src/service.ts:182`  
**Location ID: 8k** — Security hardening flags. Path: `services/publish/src/service.ts:198-217`  
**Location ID: 8l** — Env decryption and safe env injection. Path: `services/publish/src/service.ts:219`  
**Location ID: 8m** — Health daemon tick & auto-restart. Path: `services/publish/src/health.ts:56`  
**Location ID: 8n** — Stop service endpoint. Path: `services/publish/src/routes.ts:127`  
**Location ID: 8o** — Delete service endpoint. Path: `services/publish/src/routes.ts:95`

---

## Trace 9: Browser Service — Playwright Automation & SSRF Defense

**Description:** Browser service — Playwright Chromium oturum yönetimi, page navigation/interaction, screenshot/extraction ve private network SSRF koruması.

```text
Browser Service - Automation Flow
├── Session Lifecycle
│   └── POST /browser/sessions endpoint <-- 9a
│       └── browserService.createSession(userId) <-- service.ts:58
│           ├── Per-user session limit check (BROWSER_MAX_SESSIONS_PER_USER) <-- 9b
│           ├── Lazy Playwright import (Function('return import(s)')) <-- 9c
│           ├── Profile dir: BROWSER_PROFILE_DIR/{userId} (persistent cookies) <-- 9d
│           ├── launchPersistentContext — headless, 1280x800, no downloads <-- 9e
│           ├── route('**/*') — isSafeNavigationUrl() abort <-- 9f
│           │   └── Block non-http(s) & private network URLs <-- service.ts:73
│           └── Idle timer arm (BROWSER_SESSION_TIMEOUT_MS) <-- 9g
│
├── Page Interaction
│   └── POST /browser/sessions/:id/navigate <-- 9h
│       └── isSafeNavigationUrl(url) — DNS resolution + private IP check <-- 9i
│           ├── isSafeUrl(): protocol whitelist, localhost block <-- service.ts:230
│           └── dns.lookup() → isPrivateAddress() (10.x, 192.168, 172.16, fc/fd) <-- service.ts:262
│       └── page.goto(url, domcontentloaded, 30s) <-- service.ts:101
│   └── POST /browser/sessions/:id/click <-- 9j
│       └── page.click(selector, 10s) + waitForLoadState <-- service.ts:110
│   └── POST /browser/sessions/:id/fill <-- 9k
│       └── page.fill(selector, value, 10s) <-- service.ts:125
│   └── GET /browser/sessions/:id/screenshot <-- 9l
│       └── page.screenshot({ type: 'png' }) → base64 <-- service.ts:132
│   └── GET /browser/sessions/:id/extract <-- 9m
│       └── page.evaluate() — visible text + top-100 links <-- service.ts:145
│           └── Truncate text at 8000 chars for LLM context <-- service.ts:167
│
└── Cleanup
    └── DELETE /browser/sessions/:id <-- 9n
        └── disposeSession() — clearTimeout + context.close() <-- service.ts:203
```

**Location ID: 9a** — Create browser session endpoint. Path: `services/browser/src/routes.ts:67`  
**Location ID: 9b** — Per-user session rate limit. Path: `services/browser/src/service.ts:60`  
**Location ID: 9c** — Dynamic Playwright import (lazy). Path: `services/browser/src/service.ts:36`  
**Location ID: 9d** — Persistent profile directory per user. Path: `services/browser/src/service.ts:64`  
**Location ID: 9e** — launchPersistentContext config. Path: `services/browser/src/service.ts:68`  
**Location ID: 9f** — Route-level URL blocking. Path: `services/browser/src/service.ts:73`  
**Location ID: 9g** — Idle session disposal timer. Path: `services/browser/src/service.ts:194`  
**Location ID: 9h** — Navigate endpoint. Path: `services/browser/src/routes.ts:103`  
**Location ID: 9i** — SSRF-safe navigation URL check. Path: `services/browser/src/service.ts:252`  
**Location ID: 9j** — Click endpoint. Path: `services/browser/src/routes.ts:124`  
**Location ID: 9k** — Fill endpoint. Path: `services/browser/src/routes.ts:149`  
**Location ID: 9l** — Screenshot endpoint. Path: `services/browser/src/routes.ts:174`  
**Location ID: 9m** — Page text/link extraction endpoint. Path: `services/browser/src/routes.ts:196`  
**Location ID: 9n** — Close session endpoint. Path: `services/browser/src/routes.ts:83`

---

## Trace 10: Tenant Isolation Verification — Cross-Service Security Patterns

**Description:** Tüm servislerdeki tenant isolation mekanizmalarının birleşik görünümü: DB query scoping, storage path prefixing, runtime label tagging, ve inter-service auth.

```text
Tenant Isolation Verification Flow
├── Database Layer (her servis)
│   ├── Every query: and(eq(table.id, id), eq(table.userId, userId)) <-- 10a
│   │   └── auth/service.ts:85 — update users scoped by userId
│   │   └── workspace/service.ts — all workspace ops scoped
│   │   └── runtime/service.ts:87 — runtime update scoped
│   │   └── publish/service.ts:88 — hostedService update scoped
│   └── Soft-delete: deletedAt IS NULL check <-- 10b
│       └── workspace/service.ts:293 — workspaces query
│       └── publish/health.ts:86 — hostedServices query
│
├── Storage Layer
│   ├── Workspace S3 keys: {userId}/{workspaceId}/{filePath} <-- 10c
│   │   └── workspace/service.ts:150 — S3WorkspaceObjectStorage
│   ├── Runtime host paths: /tmp/workspaces/{userId}/{workspaceId} <-- 10d
│   │   └── runtime/service.ts:70 — resolveWorkspaceHostPath
│   └── Publish container binds: same hostPath:/workspace:ro <-- 10e
│       └── publish/service.ts:200
│
├── Container Runtime Labels
│   ├── pcp.userId, pcp.workspaceId, pcp.hostedServiceId <-- 10f
│   │   └── runtime/service.ts:77 — container labels
│   │   └── publish/service.ts:188 — container labels
│   └── Traefik router rule: slug.apps.localhost (per-tenant subdomain) <-- 10g
│       └── publish/service.ts:194
│
├── Inter-Service Auth
│   └── INTERNAL_SERVICE_TOKEN header <-- 10h
│   │   └── browser/routes.ts:27 — resolveAuthenticatedUserId with internal token
│   └── Session validation: validateSessionUserId() from @pcp/db <-- 10i
│       └── memory/service.ts:55
│
└── Audit Logging
    └── audit_logs table insert per security event <-- 10j
        └── auth/service.ts:32 — register/login events
        └── publish/service.ts:72 — hosted service lifecycle events
```

**Location ID: 10a** — Universal tenant-scoped DB updates. Path: `services/*/src/service.ts` (cross-service pattern)  
**Location ID: 10b** — Soft-delete guard. Path: `services/workspace/src/service.ts:293`  
**Location ID: 10c** — Tenant-prefixed S3 storage keys. Path: `services/workspace/src/service.ts:150`  
**Location ID: 10d** — Tenant-prefixed host filesystem paths. Path: `services/runtime/src/service.ts:70`  
**Location ID: 10e** — Read-only bind mount for publish containers. Path: `services/publish/src/service.ts:200`  
**Location ID: 10f** — Docker container tenant labels. Path: `services/runtime/src/service.ts:77`  
**Location ID: 10g** — Subdomain-based Traefik routing per tenant. Path: `services/publish/src/service.ts:194`  
**Location ID: 10h** — Internal service token validation. Path: `services/browser/src/routes.ts:27`  
**Location ID: 10i** — Session-based user ID validation. Path: `services/memory/src/service.ts:55`  
**Location ID: 10j** — Cross-service audit logging. Path: `services/auth/src/service.ts:32`

---

## Trace 11: BYOK Credential Security — Deep Dive

**Description:** Agent service — Kullanıcının encrypted LLM API key'inin depolanması, decrypt edilmesi, ve provider override sürecinin güvenlik detayları.

```text
BYOK Credential Security Flow
├── Storage
│   └── POST /preferences/credentials (frontend) → workspace service proxy
│       └── provider_credentials tablosuna encrypted kayıt <-- 11a
│           ├── provider (openai/anthropic/minimax) <-- schema/provider_credentials.ts
│           ├── apiKey: encryptValue() ile AES-256-GCM <-- 11b
│           └── lastUsedAt: timestamp (async update) <-- 11c
│
├── Decryption at Runtime
│   └── orchestrator.resolveUserProvider() <-- 11d
│       ├── user_preferences + provider_credentials read <-- credentials.ts:25
│       ├── decryptValue() — ENC_PREFIX kontrolü <-- 11e
│       │   └── services/agent/src/llm/credentials.ts:35
│       ├── createLLMProvider() override with decrypted key <-- 11f
│       │   └── credentials.ts:50
│       └── lastUsedAt fire-and-forget update <-- 11g
│           └── credentials.ts:43 (non-blocking)
│
└── Key Lifecycle
    └── ENCRYPTION_KEY: process.env (32 bytes required) <-- 11h
        └── publish/encryption.ts:7 — runtime check
    └── Rotation: yok (MVP gap — key rotation mekanizması eksik) <-- 11i
    └── Redaction: log'larda req.body.apiKey maskelenir <-- 11j
        └── publish/index.ts:29 — pino redact pattern
```

**Location ID: 11a** — Provider credentials DB schema. Path: `packages/db/src/schema/provider_credentials.ts`  
**Location ID: 11b** — AES-256-GCM encryption. Path: `services/publish/src/encryption.ts:14` (shared encryption pattern)  
**Location ID: 11c** — Credential usage tracking. Path: `services/agent/src/llm/credentials.ts:43`  
**Location ID: 11d** — Provider resolution entry. Path: `services/agent/src/llm/credentials.ts:25`  
**Location ID: 11e** — Decrypt value with auth tag verification. Path: `services/agent/src/llm/credentials.ts:35`  
**Location ID: 11f** — LLM provider override with user key. Path: `services/agent/src/llm/credentials.ts:50`  
**Location ID: 11g** — Async lastUsedAt update. Path: `services/agent/src/llm/credentials.ts:43`  
**Location ID: 11h** — Master encryption key validation. Path: `services/publish/src/encryption.ts:7`  
**Location ID: 11i** — Key rotation gap (documented concern). Path: `N/A — missing feature`  
**Location ID: 11j** — Log redaction for credentials. Path: `services/publish/src/index.ts:29`

---

## Ek Notlar

- **Publish service** Trace 8'de: `buildPublishSecurityOptions()` ve `policy.ts` detayları (seccomp/appArmor profile validation pattern) ilk kez dokümante ediliyor.
- **Browser service** Trace 9'da: `isSafeNavigationUrl()` DNS resolution + IP tabanlı SSRF defense, codemap'te hiç yer almamıştı.
- **Tenant Isolation** Trace 10: Cross-service birleşik görünüm, tek bir servis trace'inde yakalanamayan patterns.
- **BYOK Deep Dive** Trace 11: Sadece decrypt anı değil, encryption key lifecycle, log redaction, ve rotation gap değerlendiriliyor.
- **Error Handling** Trace 12: LLM API exception handling, tool execution try/catch, automation dead-letter pattern ve Telegram async ACK gap.
- **Transaction Boundaries** Trace 13: Multi-system (DB + S3 + Docker) atomicity eksiklikleri ve best-effort cleanup patterns.
- **Real-time Updates** Trace 14: Agent task SSE streaming, EventEmitter bridge, snapshot/live dual mode.

---

## Trace 12: Error Handling & Retry Patterns

**Description:** Agent service — LLM API hata yönetimi, tool execution exception handling, automation queue failure recovery, ve Telegram webhook async ACK pattern.

```text
Error Handling & Retry Flow
├── LLM Provider Layer
│   └── llm.generate(messages, tools) — OpenAI/Anthropic SDK call <-- 12a
│       ├── OpenAIProvider.chat.completions.create() ← no try/catch ← GAP <-- 12b
│       │   └── openai.ts:34 — throws on network/429/5xx → uncaught in runAgentLoop
│       ├── AnthropicProvider.messages.create() ← no try/catch ← GAP <-- 12c
│       │   └── anthropic.ts:52 — throws on network/429/5xx → uncaught in runAgentLoop
│       └── provider.ts:47 — developmentProviderKey() fallback (dev key leak risk) <-- 12d
│
├── Agent ReAct Loop Error Handling
│   └── runAgentLoop() for (i < maxIterations) <-- 12e
│       ├── Task cancelled check — graceful exit (currentTask.status === 'cancelled') <-- 12f
│       │   └── orchestrator.ts:452-455
│       ├── Tool execution try/catch — recoverable error pattern <-- 12g
│       │   └── orchestrator.ts:545-570
│       │   ├── registry.execute() throws → catch(error) <-- orchestrator.ts:558
│       │   ├── toolOutputStr = `Error executing tool: ${error.message}` <-- 12h
│       │   ├── completeToolCall(status: 'failed', error) <-- orchestrator.ts:560
│       │   ├── emitAudit('TOOL_EXECUTE', ok: false) <-- orchestrator.ts:564
│       │   └── Observation step inserted with error text ← loop continues ← 12i
│       └── Exceeded max iterations — deterministic failure <-- 12j
│           └── orchestrator.ts:622-636 — status 'failed', cleanupTaskEmitter
│
├── Automation Queue Failure Recovery
│   └── BullMQ Worker processor catch block <-- 12k
│       └── automation/queue.ts:86-119
│       ├── Error caught → logger.error({ runId, error }) <-- 12l
│       ├── DB update automationRuns → status: 'failed', error: message <-- queue.ts:91
│       ├── dispatchAutomationRunNotification(status: 'failed') ← in-app/email/webhook <-- 12m
│       └── worker.on('failed') → extra dead-letter logging ← queue.ts:125-126 ← 12n
│
└── Telegram Channel Async ACK Pattern (non-blocking inbound)
    └── POST /channels/telegram/webhook ← ACK immediately, work async <-- 12o
        └── routes/channels.ts:235-248
        ├── reply.send({ ok: true }) — 200 response to Telegram <-- 12p
        └── void handleIncoming(...).catch(...) — fire-and-forget <-- 12q
            └── Prevents Telegram retry storms on slow agent loops
```

**Location ID: 12a** — LLM generation entry in ReAct loop. Path: `services/agent/src/orchestrator.ts:457`  
**Location ID: 12b** — OpenAI SDK call without retry wrapper. Path: `services/agent/src/llm/openai.ts:34`  
**Location ID: 12c** — Anthropic SDK call without retry wrapper. Path: `services/agent/src/llm/anthropic.ts:52`  
**Location ID: 12d** — Development provider key fallback (risk). Path: `services/agent/src/llm/provider.ts:47`  
**Location ID: 12e** — ReAct loop start. Path: `services/agent/src/orchestrator.ts:450`  
**Location ID: 12f** — Graceful cancellation check. Path: `services/agent/src/orchestrator.ts:452`  
**Location ID: 12g** — Tool execution error recovery block. Path: `services/agent/src/orchestrator.ts:545`  
**Location ID: 12h** — Error converted to observation text. Path: `services/agent/src/orchestrator.ts:559`  
**Location ID: 12i** — Loop continues after tool error. Path: `services/agent/src/orchestrator.ts:570`  
**Location ID: 12j** — Max iteration failure path. Path: `services/agent/src/orchestrator.ts:622`  
**Location ID: 12k** — Automation worker error catch. Path: `services/agent/src/automation/queue.ts:86`  
**Location ID: 12l** — Structured error logging with runId. Path: `services/agent/src/automation/queue.ts:87`  
**Location ID: 12m** — Failed-run user notification. Path: `services/agent/src/automation/queue.ts:103`  
**Location ID: 12n** — Dead-letter worker listener. Path: `services/agent/src/automation/queue.ts:125`  
**Location ID: 12o** — Telegram webhook handler. Path: `services/agent/src/routes/channels.ts:232`  
**Location ID: 12p** — Immediate ACK to prevent Telegram retries. Path: `services/agent/src/routes/channels.ts:250`  
**Location ID: 12q** — Async fire-and-forget processing. Path: `services/agent/src/routes/channels.ts:236`

---

## Trace 13: Transaction Boundaries — Multi-System Atomicity Gaps

**Description:** Birden fazla external system (DB + S3 + Docker) kullanan operasyonlardaki atomicity eksiklikleri ve compensating action patterns.

```text
Transaction Boundary Analysis
├── Workspace File Upload (Best-effort, no rollback)
│   └── service.createFile() — workspace/service.ts <-- 13a
│       ├── assertSafePath() + assertWorkspaceOwned() ← read-only guards <-- 13b
│       ├── S3 Upload (Upload SDK) ← async, no DB transaction wrapper ← 13c
│       │   └── service.ts:250 — new Upload().done()
│       ├── DB insert workspace_files ← AFTER S3 success ← 13d
│       │   └── service.ts:280
│       ├── DB update workspace quota ← AFTER file insert ← 13e
│       │   └── service.ts:295
│       └── GAP: S3 succeeds but DB insert fails → orphan S3 object ← 13f
│
├── Runtime Creation (Two-phase, no rollback on Docker failure)
│   └── createRuntime() — runtime/service.ts <-- 13g
│       ├── DB insert runtimes (status: 'pending') ← Phase 1 ← 13h
│       │   └── service.ts:57-64
│       ├── mkdir workspace host path (filesystem) ← Phase 2 ← 13i
│       │   └── service.ts:70
│       ├── Docker createContainer + start ← Phase 3 ← 13j
│       │   └── service.ts:72-75
│       ├── DB update runtimes (containerId, status: 'running') ← Phase 4 ← 13k
│       │   └── service.ts:84-86
│       ├── DB insert runtimeEvents (type: 'create') ← Phase 5 ← 13l
│       │   └── service.ts:89-91
│       └── GAP: Docker start fails after DB pending insert → zombie record ← 13m
│
├── Publish Service Start (Async background, eventual consistency)
│   └── startService() — publish/service.ts <-- 13n
│       ├── DB update status → 'starting' (synchronous) ← 13o
│       │   └── service.ts:116-119
│       └── runContainer() — fire-and-forget background ← 13p
│           ├── Docker createContainer + start ← async, may fail silently ← 13q
│           └── DB update status → 'running' or 'crashed' ← eventual ← 13r
│               └── service.ts:222-247
│
└── Agent Task Creation (Multi-table, no cross-table transaction)
    └── orchestrator.createTask() — agent/orchestrator.ts <-- 13s
        ├── DB insert tasks ← 13t
        │   └── orchestrator.ts:213
        ├── DB insert taskSteps (system prompt as step) ← 13u
        │   └── orchestrator.ts:230
        └── GAP: task insert succeeds but step insert fails → orphan task with no steps ← 13v
```

**Location ID: 13a** — File upload entry. Path: `services/workspace/src/service.ts:230`  
**Location ID: 13b** — Pre-flight validation. Path: `services/workspace/src/service.ts:240`  
**Location ID: 13c** — S3 upload without transaction wrapper. Path: `services/workspace/src/service.ts:250`  
**Location ID: 13d** — File metadata DB insert. Path: `services/workspace/src/service.ts:280`  
**Location ID: 13e** — Storage quota update. Path: `services/workspace/src/service.ts:295`  
**Location ID: 13f** — Orphan S3 object gap. Path: `N/A — compensating action missing`  
**Location ID: 13g** — Runtime creation entry. Path: `services/runtime/src/service.ts:53`  
**Location ID: 13h** — Phase 1: pending DB record. Path: `services/runtime/src/service.ts:57`  
**Location ID: 13i** — Phase 2: host path creation. Path: `services/runtime/src/service.ts:70`  
**Location ID: 13j** — Phase 3: Docker container start. Path: `services/runtime/src/service.ts:72`  
**Location ID: 13k** — Phase 4: container ID persistence. Path: `services/runtime/src/service.ts:84`  
**Location ID: 13l** — Phase 5: event log insert. Path: `services/runtime/src/service.ts:89`  
**Location ID: 13m** — Zombie record gap. Path: `N/A — cleanup cron missing`  
**Location ID: 13n** — Publish start entry. Path: `services/publish/src/service.ts:107`  
**Location ID: 13o** — Synchronous status update. Path: `services/publish/src/service.ts:116`  
**Location ID: 13p** — Async container runner. Path: `services/publish/src/service.ts:122`  
**Location ID: 13q** — Silent Docker failure. Path: `services/publish/src/service.ts:154`  
**Location ID: 13r** — Eventual status resolution. Path: `services/publish/src/service.ts:222`  
**Location ID: 13s** — Task creation entry. Path: `services/agent/src/orchestrator.ts:204`  
**Location ID: 13t** — Task insert. Path: `services/agent/src/orchestrator.ts:213`  
**Location ID: 13u** — Initial step insert. Path: `services/agent/src/orchestrator.ts:230`  
**Location ID: 13v** — Orphan task gap. Path: `N/A — transaction wrapper missing`

---

## Trace 14: Real-time SSE Client Updates — Agent Task Streaming

**Description:** Agent orchestrator'dan frontend'e Server-Sent Events (SSE) ile task status/step canlı akışı. EventEmitter bridge, snapshot/live dual mode, ve cleanup patterns.

```text
Real-time Task Event Streaming Flow
├── Backend: AgentOrchestrator EventEmitter Bridge
│   └── subscribeToTask(taskId) — creates EventEmitter per task <-- 14a
│       └── orchestrator.ts:95-99
│   ├── emitTaskUpdate(taskId, data) — 'task' event <-- 14b
│   │   └── orchestrator.ts:102-104
│   ├── emitTaskStep(taskId, data) — 'step' event <-- 14c
│   │   └── orchestrator.ts:106-108
│   └── cleanupTaskEmitter(taskId) — removes listeners on completion/failure <-- 14d
│       └── orchestrator.ts:110-116
│
├── Backend: SSE Endpoint (/agent/tasks/:id/events)
│   └── GET /agent/tasks/:id/events — Server-Sent Events <-- 14e
│       └── agent/routes.ts:220-277
│       ├── Headers: Content-Type: text/event-stream, no-cache, keep-alive <-- 14f
│       │   └── routes.ts:235-237
│       ├── Snapshot mode (?snapshot=true) ← historical replay <-- 14g
│       │   ├── Fetch current task state → sendEvent('task', task) ← routes.ts:245-247
│       │   └── Replay all existing steps → sendEvent('step', step) ← routes.ts:249-251
│       └── Live mode (default) ← real-time subscription <-- 14h
│           ├── emitter.on('task', onTask) ← routes.ts:270
│           ├── emitter.on('step', onStep) ← routes.ts:271
│           └── onTask detects terminal status → cleanup() ← auto listener removal ← 14i
│               └── routes.ts:263-264
│
└── Frontend: Consumption Patterns
    └── (Web) useTaskStream hook (inferred) ← connects to SSE, hydrates Zustand store
    └── (Terminal) use-terminal.ts:99 — WebSocket for runtime PTY ← separate protocol
```

**Event Timeline during a Task Execution:**
1. **task** `{ status: 'executing' }` — loop starts (`orchestrator.ts:417`)
2. **step** `{ type: 'thought', content: '...' }` — each LLM response (`orchestrator.ts:473`)
3. **step** `{ type: 'action', toolName: '...' }` — tool call recorded (`orchestrator.ts:508`)
4. **step** `{ type: 'observation', toolOutput: '...' }` — tool result/error (`orchestrator.ts:581`)
5. **task** `{ status: 'waiting_approval' }` — approval gate hit (`orchestrator.ts:532`)
6. **task** `{ status: 'completed', output: '...' }` — success (`orchestrator.ts:609`)
7. **task** `{ status: 'failed', output: '...' }` — max iterations or unhandled exception (`orchestrator.ts:630`)

**Location ID: 14a** — EventEmitter subscription manager. Path: `services/agent/src/orchestrator.ts:95`  
**Location ID: 14b** — Task status event emission. Path: `services/agent/src/orchestrator.ts:102`  
**Location ID: 14c** — Step event emission. Path: `services/agent/src/orchestrator.ts:106`  
**Location ID: 14d** — Emitter cleanup on terminal state. Path: `services/agent/src/orchestrator.ts:110`  
**Location ID: 14e** — SSE endpoint handler. Path: `services/agent/src/routes.ts:220`  
**Location ID: 14f** — SSE HTTP headers. Path: `services/agent/src/routes.ts:235`  
**Location ID: 14g** — Snapshot replay mode. Path: `services/agent/src/routes.ts:244`  
**Location ID: 14h** — Live event subscription. Path: `services/agent/src/routes.ts:257`  
**Location ID: 14i** — Auto-cleanup on terminal event. Path: `services/agent/src/routes.ts:263`
