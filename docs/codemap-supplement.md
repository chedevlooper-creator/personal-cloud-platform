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
