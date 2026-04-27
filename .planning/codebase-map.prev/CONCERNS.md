# CONCERNS — personal-cloud-platform

Audit date: 2026-04-27. Source-grounded; every finding has a file:line citation.
Severity legend: **CRITICAL** = exploitable by unauthenticated user / leaks tenant data / RCE; **HIGH** = exploitable by authenticated user against other tenants or against host; **MEDIUM** = degraded posture, weak control, or correctness bug with security flavor; **LOW** = hygiene / ops debt.

Scope summary: 6 Fastify services (`auth`, `workspace`, `runtime`, `agent`, `memory`, `publish`), Next.js 16 web (`apps/web`), Drizzle schema (`packages/db`). Postgres + Redis + MinIO + Traefik via `infra/docker/docker-compose.yml`.

---

## CRITICAL

### C1 — Publish service has no authentication; trusts `userId` from request body/query (full IDOR)

- **Severity:** CRITICAL
- **Location:** `services/publish/src/routes.ts:12-32, 47-66, 88-90, 138`; `services/publish/src/service.ts:13-40, 127-149`
- **Evidence:**
  ```ts
  // routes.ts:12-14, 32
  querystring: z.object({ userId: z.string().uuid() }),
  ...
  const apps = await publishService.listApps(request.query.userId);
  // routes.ts:47-50, 64
  body: z.object({ userId: z.string().uuid(), workspaceId: ..., name, subdomain, config }),
  ...
  const result = await publishService.createApp(request.body);
  // service.ts:35-39
  async listApps(userId: string) {
    return db.query.publishedApps.findMany({ where: eq(publishedApps.userId, userId), ... });
  }
  ```
  Routes `POST /publish/apps/:id/deploy`, `GET /publish/apps/:id/deployments`, `DELETE /publish/apps/:id` (`routes.ts:69-141`) never look up the caller and never check that the caller owns the app — the app id alone is sufficient.
- **Impact:** Anyone with network access to the publish service (port 3006) can list, create, deploy, and delete _any_ user's apps; spawn arbitrary `nginx:alpine` containers on the host (`service.ts:83-95`); enumerate UUIDs to wipe tenants. There is no `validateUserFromCookie` call anywhere in the service.
- **Fix:** Apply the same `getAuthenticatedUserId(request.cookies.sessionId)` pattern used by every other service; remove `userId` from request schemas; scope every query by the cookie-derived userId.

### C2 — Hardcoded fallback cookie/session secret across all 5 cookie-using services

- **Severity:** CRITICAL
- **Location:**
  - `services/auth/src/index.ts:36`
  - `services/workspace/src/index.ts:29`
  - `services/runtime/src/index.ts:29`
  - `services/agent/src/index.ts:29`
  - `services/memory/src/index.ts:28`
- **Evidence (identical in all five):**
  ```ts
  server.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'super-secret-key-replace-in-prod',
    hook: 'onRequest',
  });
  ```
- **Impact:** If `COOKIE_SECRET` is unset (and `.env.example` does not declare one — see L3), every service silently falls back to a public, source-tree-known value. Any signed cookie produced by the platform can be forged by anyone who has read the GitHub repo.
- **Fix:** Validate `COOKIE_SECRET` with Zod at startup (the `packages/db/src/client.ts:7-13` pattern) and crash if missing. Remove the fallback string entirely.

### C3 — Publish service registers `@fastify/cookie` with no secret at all

- **Severity:** CRITICAL
- **Location:** `services/publish/src/index.ts:32` — `app.register(cookie);`
- **Evidence:** No options object; `secret` is undefined, so `reply.signCookie` would throw and any signed-cookie validation is a no-op.
- **Impact:** Combined with C1, the publish service is fully unauthenticated and cannot even produce signed session cookies if it tried to.
- **Fix:** Either remove the `cookie` plugin from `publish` (it is unused) or register it with the same validated `COOKIE_SECRET` as other services and add real auth.

### C4 — Next.js auth middleware never runs (file misnamed `proxy.ts`, function exported as `proxy`)

- **Severity:** CRITICAL
- **Location:** `apps/web/proxy.ts:4` (and there is a duplicate at `apps/web/src/proxy.ts`)
- **Evidence:**
  ```ts
  // apps/web/proxy.ts
  export function proxy(request: NextRequest) { ... }
  export const config = { matcher: [...] };
  ```
  Next.js only recognizes `middleware.ts` exporting a function named `middleware` (or default). A file named `proxy.ts` is dead code — the `matcher` is never installed.
- **Impact:** The intended `/login` redirect for unauthenticated visitors and the `/dashboard` redirect for already-logged-in visitors **never fire**. All client-side gating relies on backend 401s; SPA routes that don't fetch protected APIs are exposed.
- **Fix:** Rename to `apps/web/src/middleware.ts` and rename the export to `middleware`. Delete the stale `apps/web/proxy.ts` copy.

### C5 — Container image is fully user-controlled; runtime spawns arbitrary Docker images on the host

- **Severity:** CRITICAL
- **Location:** `services/runtime/src/routes.ts:30-31`; `services/runtime/src/service.ts:31-49`; `services/runtime/src/provider/docker.ts:11-26`; schema `packages/shared/src/runtime.ts:5` (`image: z.string().default('node:18-alpine')`).
- **Evidence:** The Zod schema accepts any string for `image`; the value is passed straight to `docker.createContainer({ Image: image, ... })`. There is no allow-list, no registry pin, no digest verification.
- **Impact:** Authenticated user can pull and run any public (or, with Docker credentials, private) image — including images that exfiltrate `/workspace` mounts, mine, or exploit kernel CVEs. Combined with the absent CPU/Memory defaults (see H4) this is also a host DoS vector.
- **Fix:** Replace `image: z.string()` with `z.enum([...allowList])`, and pin to digests. Reject any image not on the list before calling Docker.

### C6 — Publish service mounts the host Docker socket read/write

- **Severity:** CRITICAL
- **Location:** `services/publish/src/service.ts:10` — `new Docker({ socketPath: '/var/run/docker.sock' })`
- **Evidence:** `runDeployment` (`service.ts:69-115`) creates and starts containers with attacker-controlled labels (`app.subdomain` is user-supplied via C1) on the production network `pcp_network`.
- **Impact:** Compromise of (or, today, anonymous access to) the publish service is equivalent to root on the Docker host. Combined with C1, **any unauthenticated network caller can `docker run` on the host**.
- **Fix:** Run publish behind real auth (C1), move container orchestration into a privileged worker that consumes a queue, validate `subdomain` against a strict regex, and consider rootless Docker / a dedicated daemon socket with limited capabilities.

### C7 — OAuth access & refresh tokens stored in plaintext varchar columns

- **Severity:** CRITICAL
- **Location:** `packages/db/src/schema/oauth_accounts.ts:8-9`; `services/auth/src/service.ts:96-107`
- **Evidence:**
  ```ts
  // schema
  accessToken: varchar('access_token', { length: 1024 }),
  refreshToken: varchar('refresh_token', { length: 1024 }),
  // service.ts:101-107
  await db.insert(oauthAccounts).values({
    providerId, providerUserId, userId,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });
  ```
  No encryption layer is invoked despite `provider_credentials` schema explicitly documenting AES-256-GCM (`packages/db/src/schema/provider_credentials.ts:14-29`).
- **Impact:** A read-only DB leak hands attackers live Google access tokens for every linked account.
- **Fix:** Encrypt at rest with `ENCRYPTION_KEY` (currently unused — see C8); store `iv`/`authTag` columns parallel to `provider_credentials`.

### C8 — `ENCRYPTION_KEY` declared in env example but never read by any code; `provider_credentials` table has zero writers/readers

- **Severity:** CRITICAL (planned-but-unimplemented secrets store)
- **Location:** `infra/docker/.env.example:23`; `packages/db/src/schema/provider_credentials.ts:18-40`. `grep -rn "ENCRYPTION_KEY" --include="*.ts"` returns no hits in service code.
- **Evidence:** Schema documents AES-256-GCM ciphertext columns (`encryptedKey`, `iv`, `authTag`, `keyVersion`), but the only references in the repo are the schema file and its export in `packages/db/src/schema/index.ts:14`. No insert/select against the table exists.
- **Impact:** The advertised "BYOK" credential vault is a stub. Any code that today needs to "remember" a provider key (Anthropic, OpenAI, integrations) has no encrypted storage path; this strongly invites future plaintext-in-DB shortcuts (already happened for OAuth — C7).
- **Fix:** Implement an `EncryptionService` in `packages/shared` that reads `ENCRYPTION_KEY` (32-byte base64), provides `encrypt(plaintext) → {ciphertext,iv,authTag}` + `decrypt(...)`, validates key presence at boot, and route OAuth tokens + provider keys through it.

### C9 — `AUTH_BYPASS=1` env flag short-circuits auth in the agent service and in the (currently dead) Next.js middleware

- **Severity:** CRITICAL (high-blast-radius footgun)
- **Location:** `services/agent/src/routes.ts:12` and `apps/web/proxy.ts:5-7`
- **Evidence:**
  ```ts
  // agent/src/routes.ts
  if (process.env.AUTH_BYPASS === '1') return 'local-dev-user';
  // apps/web/proxy.ts
  if (process.env.AUTH_BYPASS === '1') return NextResponse.next();
  ```
  Sets every request's identity to a hardcoded `'local-dev-user'`, who then becomes the owner of any task created. There is no environment guard (`NODE_ENV !== 'production'`), no startup warning, no audit trail.
- **Impact:** A single misconfigured env in production turns `/agent/*` into an unauthenticated endpoint and silently impersonates a fixed user. Risk of leaking into prod via a copied `.env`.
- **Fix:** Gate the bypass behind `NODE_ENV === 'development' || NODE_ENV === 'test'`, log a loud warning at startup, and ideally remove it in favor of a dev-fixture cookie generator.

---

## HIGH

### H1 — All services use `cors({ origin: true, credentials: true })`

- **Severity:** HIGH
- **Location:** `services/auth/src/index.ts:25-28`; `services/workspace/src/index.ts:23-26`; `services/runtime/src/index.ts:23-26`; `services/agent/src/index.ts:23-26`; `services/memory/src/index.ts:23-26`; `services/publish/src/index.ts:28-31`.
- **Evidence:** `origin: true` reflects the request's `Origin` header back as `Access-Control-Allow-Origin`; combined with `credentials: true` this defeats CORS protection entirely — any third-party site visited by a logged-in user can issue authenticated requests with `fetch(..., { credentials: 'include' })`.
- **Impact:** CSRF/CORF on all authenticated endpoints. Workspace files, agent tasks, runtimes, and memory are reachable cross-origin.
- **Fix:** Allow only known origins (e.g. `process.env.FRONTEND_URL`) and reject all others. Validate at boot.

### H2 — No CSRF protection (no SameSite=strict, no CSRF token, lax cookie)

- **Severity:** HIGH
- **Location:** Cookie set sites in `services/auth/src/routes.ts:52-58, 89-95, 144-150, 197-203`.
- **Evidence:** All session cookies are `sameSite: 'lax'`. With H1's CORS, top-level GET-triggered requests and same-site POSTs have no CSRF mitigation.
- **Impact:** Compounds H1; even tightening CORS still leaves state-changing requests vulnerable to top-level-navigation CSRF without strict SameSite or a token.
- **Fix:** Move to `sameSite: 'strict'` for cookie auth, or add a synchronizer-token / double-submit pattern via a Fastify hook.

### H3 — `runtime.execCommand` "security policy" is regex theater

- **Severity:** HIGH
- **Location:** `services/runtime/src/service.ts:99-102`
- **Evidence:**
  ```ts
  const blockedPatterns = [/rm\s+-rf\s+\//, /^sudo\b/, /:\(\)\{\s*:\|:&\s*\};:/];
  if (blockedPatterns.some((pattern) => pattern.test(commandStr))) {
    throw new Error('Command blocked by security policy');
  }
  ```
  Trivially bypassed: `rm -r -f /`, `RM -RF /`, `bash -c "rm -rf /"`, `/usr/bin/rm -rf /`, `\sudo`, etc.
- **Impact:** Falsely advertises a control. Future code paths or operators may rely on it. Inside the container this is mostly cosmetic, but as soon as containers are run with looser isolation (see H4/C5) the gap matters.
- **Fix:** Delete the blocklist; rely on container isolation, image whitelist, NetworkMode, dropped capabilities, read-only rootfs, and per-runtime timeouts. Don't ship a regex marketed as security.

### H4 — DockerProvider has no default CPU/Memory limits and no PID/ulimit caps

- **Severity:** HIGH
- **Location:** `services/runtime/src/provider/docker.ts:13-22`
- **Evidence:**
  ```ts
  HostConfig: {
    Binds: [`${options.workspacePath}:/workspace`],
    Memory: options.memory ? options.memory * 1024 * 1024 : undefined,
    NanoCpus:  options.cpu  ? options.cpu  * 1e9         : undefined,
    NetworkMode: 'none',
  },
  ```
  When the user (or default schema) omits `memory`/`cpu`, the container has unlimited host resources. `PidsLimit`, `ReadonlyRootfs`, `CapDrop`, `SecurityOpt` are all unset.
- **Impact:** Any authenticated user can DoS the host with a fork bomb / memory bomb. Combined with C5 → near-trivial host takeover.
- **Fix:** Always set sensible defaults (`Memory: 512MiB`, `NanoCpus: 0.5e9`, `PidsLimit: 256`), drop `CAP_SYS_ADMIN` etc., set `ReadonlyRootfs: true` plus a tmpfs `/tmp`, and add `SecurityOpt: ['no-new-privileges:true']`.

### H5 — Multipart upload trusts client-supplied MIME and lacks server-side size accounting

- **Severity:** HIGH
- **Location:** `services/workspace/src/routes.ts:300-346`; `services/workspace/src/service.ts:332-411`
- **Evidence:**
  - The route forwards `data.mimetype` straight from the multipart request into S3 metadata and the DB (`service.ts:347, 375, 390`).
  - `uploadFile` never measures stream length: `if (stream.hasOwnProperty('byteCount')) { size = (stream as any).byteCount; }` — `hasOwnProperty('byteCount')` returns `false` on Fastify's stream, so `size` stays `0`.
- **Impact:** (a) Users bypass the per-workspace storage quota check (`storageUsed + data.size > storageLimit` in `createFile` is unreachable here), (b) attackers can upload an executable as `image/png`, (c) downstream previewers will trust the wrong MIME.
- **Fix:** Pipe through a `Transform` that counts bytes and enforces `storageLimit` mid-stream; sniff MIME server-side (`file-type` or magic bytes); reject unknown types; bound `request.file()` with `limits.fileSize` plus a connection-level guard.

### H6 — Path traversal possible in workspace file paths and S3 storage keys

- **Severity:** HIGH
- **Location:** `services/workspace/src/service.ts:497-501, 511-513`
- **Evidence:**
  ```ts
  private normalizeFilePath(filePath: string): string {
    const trimmed = filePath.trim();
    if (!trimmed || trimmed === '/') return '/';
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
  private getStorageKey(userId, workspaceId, filePath) {
    return `${userId}/${workspaceId}${this.normalizeFilePath(filePath)}`;
  }
  ```
  `..` segments and embedded `\0`/`\n` are not stripped. Routes accept `path` from body/query (`routes.ts:165, 234, 240, 272, 321, 380`).
- **Impact:** A user can craft `path=/../<otherUserId>/...` and write/read S3 keys outside their own prefix. While the DB row is still scoped to `workspaceId`, the _object storage key_ is not — so a malicious user can clobber another tenant's S3 object if they can guess the key (their own userId is server-derived but the trailing path is wide open). Also enables logical confusion in DB (two paths normalize identically with different parent paths).
- **Fix:** In `normalizeFilePath` resolve to canonical form using `posix.normalize`, reject any output that starts with `..` or contains `..` segments, and forbid control characters.

### H7 — `request.body.input` to `/agent/chat` is unauthenticated-against-tenant and unbounded in cost

- **Severity:** HIGH
- **Location:** `services/agent/src/routes.ts:17-48`; `services/agent/src/orchestrator.ts:165-174`
- **Evidence:** Auth check exists, but `chat` is never rate-limited and never billed-back to a user record. Each call hits the LLM with up to 12 000 chars of input and 4 096 tokens of output (`anthropic.ts:40`). No per-user quota is enforced.
- **Impact:** Authenticated user (or one user via H1 CSRF) can drain the platform's LLM credits. With C9 a misconfigured prod becomes unauthenticated draining.
- **Fix:** Per-user `@fastify/rate-limit`, per-user monthly token quota stored alongside `userPreferences`, and a circuit breaker on provider 429s.

### H8 — `JSON.parse(toolCall.arguments)` of LLM output is outside the try/catch

- **Severity:** HIGH (reliability) / MEDIUM (security)
- **Location:** `services/agent/src/orchestrator.ts:221, 230`
- **Evidence:**
  ```ts
  await db.insert(toolCalls).values({ ..., args: JSON.parse(toolCall.arguments), ... });
  await db.insert(taskSteps).values({ ..., toolInput: JSON.parse(toolCall.arguments) });
  ```
  These calls happen before the per-tool try/catch (line 245). A malformed arguments string from the LLM throws and bubbles to the top-level `.catch` that just logs (line 130-133), leaving the task in `executing`.
- **Impact:** Any LLM emitting invalid JSON wedges the task forever; users can't retry without manual DB intervention. Could also be triggered deliberately via prompt injection.
- **Fix:** Wrap `JSON.parse` in a try/catch, mark the task `failed` with a clear reason, and emit an observation step.

### H9 — Fire-and-forget async work has no durability

- **Severity:** HIGH
- **Location:** `services/agent/src/orchestrator.ts:130-133, 310, 336`; `services/publish/src/service.ts:61`
- **Evidence:** Long-running jobs (`runAgentLoop`, `runDeployment`, `submitToolApproval` resume) are launched as bare promises with `.catch(console.error)` (or `.catch(err => log)`). No queue, no retry, no idempotency key.
- **Impact:** A SIGKILL or pod restart leaves tasks in `executing`/`waiting_approval` and deployments in `building`/`running` forever. No way to resume cleanly. Redis is provisioned but unused (see L5) — BullMQ would be the obvious fit.
- **Fix:** Move long jobs into a BullMQ queue with `attempts`, `backoff`, and worker-side idempotency. On startup, scan for orphaned `executing` tasks and re-enqueue or mark `failed`.

### H10 — No graceful shutdown anywhere; SIGTERM kills in-flight requests and DB connections

- **Severity:** HIGH (reliability)
- **Location:** All six service entry points (`services/*/src/index.ts`); confirmed by `grep -rn "SIGTERM" services/*/src` returning nothing.
- **Evidence:** `process.exit(1)` on listen failure is the only signal handling.
- **Impact:** Rolling deploys drop in-flight requests; postgres connection pool from `packages/db/src/client.ts:16-18` (`max: 10`) leaks sockets; tasks in the agent loop interrupt mid-step.
- **Fix:** In each service, on `SIGTERM`/`SIGINT` call `await server.close()` (Fastify drains in-flight) then `await queryClient.end({ timeout: 5 })` from `@pcp/db`, then `process.exit(0)`.

---

## MEDIUM

### M1 — Rate limiting only covers `services/auth`; everything else is unlimited

- **Severity:** MEDIUM
- **Location:** Only `services/auth/src/index.ts:30-33` registers `@fastify/rate-limit`. Per-route caps (`5/min`) exist on `/auth/register` and `/auth/login` (`routes.ts:30-34, 67-72`).
- **Evidence:** `services/workspace/package.json:18` has `@fastify/rate-limit` declared but it is never `register`-ed in `index.ts`. `services/runtime`, `services/agent`, `services/memory`, `services/publish` don't even depend on it.
- **Impact:** Brute force and abuse vectors on `/agent/chat` (H7), `/workspaces/:id/upload` (H5 size DoS), `/runtimes/:id/exec`, `/memory/search` (each call costs an embedding), and (currently anonymous) `/publish/apps` (C1).
- **Fix:** Register `@fastify/rate-limit` in every service with a global default and tighter per-route caps on expensive endpoints.

### M2 — `validateSession` extends session expiry by 30 days on every read with no rotation

- **Severity:** MEDIUM
- **Location:** `services/auth/src/service.ts:128-135`
- **Evidence:** When less than 15 days remain, expiresAt is bumped to +30d but the session id stays the same. Active attackers stay logged in indefinitely on a stolen sessionId.
- **Fix:** On extension, _rotate_ the session id (issue new id, delete old), like `refreshSession` already does (`service.ts:152-167`).

### M3 — `auditLogs` insert can fail silently and is the only audit channel

- **Severity:** MEDIUM
- **Location:** `services/auth/src/service.ts:11-22`
- **Evidence:** `logAudit` swallows errors with `this.logger.error(...)` then returns. There is no fallback to a durable journal.
- **Impact:** A DB hiccup during an attack erases the audit trail of that exact event.
- **Fix:** Buffer audit events to Redis Stream / file when DB is down, or fail-closed for security-sensitive actions.

### M4 — `addMemory` accepts `workspaceId` from request without verifying caller owns the workspace

- **Severity:** MEDIUM
- **Location:** `services/memory/src/routes.ts:30-33`; `services/memory/src/service.ts:31-44`
- **Evidence:** `memory.routes.ts` derives `userId` from cookie correctly, but inserts `workspaceId: workspaceId || null` without checking `workspaces.userId`.
- **Impact:** A user can attach memories to a workspaceId they don't own. Reads are still gated by `user_id` in `searchMemory` (`service.ts:54`), so cross-tenant _read_ leakage is unlikely, but the row violates the tenant invariant in `.cursor/rules/database.mdc` and could surface in future analytics joined on `workspaceId`.
- **Fix:** Look up the workspace and verify `workspaces.userId === userId` before insert; same for `updateMemory` if `workspaceId` becomes editable.

### M5 — `searchMemory` SQL builds a `WHERE` clause from string concatenation of `sql` fragments

- **Severity:** MEDIUM (low exploitability — values are parameterized, but pattern is dangerous)
- **Location:** `services/memory/src/service.ts:46-77`
- **Evidence:**
  ```ts
  const embeddingStr = `[${queryEmbedding.join(',')}]`;
  ...
  ORDER BY embedding <-> ${embeddingStr}::vector
  ```
  `embeddingStr` is interpolated as text via `sql\`...\``and then cast — values from`embeddings.generate` are numeric so today this is safe, but the pattern relies on the upstream provider always returning numbers and never NaN/Infinity/strings.
- **Impact:** A buggy or compromised embeddings provider could inject arbitrary SQL via `embeddingStr`. The `limit` is also interpolated directly (line 73), and while `searchMemorySchema` should constrain it, that is the only line of defense.
- **Fix:** Validate every component of `queryEmbedding` is a finite number before interpolation; use a parameterized cast (`${sql.raw('::vector')}` is fine, but values should go through a typed param).

### M6 — `attachTerminal` WebSocket has no per-message size limit, no idle timeout, and shares one `runtimes` row across reconnects

- **Severity:** MEDIUM
- **Location:** `services/runtime/src/routes.ts:101-144`
- **Evidence:** Stream-to-socket pumping with no `connection.socket.setMaxListeners` / no message size cap / no auth re-check on long-lived sockets / no per-connection rate limiting.
- **Impact:** A single user can hold many sockets open, push gigabytes through, or keep a session alive after their cookie was invalidated.
- **Fix:** Cap message size, enforce idle timeout, periodically re-validate session, add per-user concurrent-connection limits.

### M7 — Multi-step writes are not wrapped in transactions

- **Severity:** MEDIUM (correctness/integrity)
- **Location:** `services/auth/src/service.ts:36-49` (user insert + session insert + audit log), `services/workspace/src/service.ts:185-198` (workspace insert + seed file inserts + S3 puts), `services/agent/src/orchestrator.ts:107-136` (conversation + task + fire-and-forget), `services/runtime/src/service.ts:31-58` (runtime insert + event insert after Docker create).
- **Evidence:** No `db.transaction(async (tx) => …)` calls anywhere in the services.
- **Impact:** A crash between writes leaves orphaned rows (e.g. a user with no session, a runtime record without an event, a workspace without seed files) and possibly orphaned external resources (Docker containers, S3 objects).
- **Fix:** Wrap each multi-write logical operation in `db.transaction`. Use compensating actions for external side-effects (S3, Docker) — e.g. allocate UUIDs first, do external work, commit DB row last.

### M8 — `publish.runDeployment` stores raw error message in `appDeployments.logs.error` without redaction

- **Severity:** MEDIUM
- **Location:** `services/publish/src/service.ts:107-115`
- **Evidence:** `logs: { error: error.message }` — Docker errors can contain socket paths, internal IPs, image registry credentials when Docker login is in play.
- **Impact:** Sensitive infra detail surfaces to API consumers via `GET /publish/apps/:id/deployments` (returns `logs`). Also bypasses the structured-pino-no-PII rule.
- **Fix:** Categorize errors to a known set ('image_pull_failed', 'create_failed', etc.); log raw via `pino` only.

### M9 — Tool registry executes against simulated stubs, not the real services

- **Severity:** MEDIUM (correctness; security-flavored because false-positive observations end up in the audit-rated steps log)
- **Location:** `services/agent/src/tools/run_command.ts:27-30`; `services/agent/src/tools/read_file.ts:27-29`
- **Evidence:** "Simulated execution of: …" / "Simulated file content for …".
- **Impact:** The approval flow logs `awaiting_approval` for `run_command`, but the eventual execution is a stub — the system advertises a control surface (tool approval, audit log) while doing nothing. Users may rely on this perceived security boundary.
- **Fix:** Wire to real `services/runtime` and `services/workspace` over HTTP, _or_ visibly disable the tool until backed.

### M10 — `provider_credentials` table is dead code and `oauth_accounts` plaintext columns coexist with it

- **Severity:** MEDIUM (architectural drift)
- **Location:** `packages/db/src/schema/provider_credentials.ts:14-40`; `packages/db/src/schema/oauth_accounts.ts:8-9`
- **Impact:** Two parallel "secret store" designs; the safe one (encrypted) has no callers, the unsafe one is in production.
- **Fix:** See C7 + C8 — implement the encrypted store, migrate OAuth tokens into it, drop the plaintext columns.

### M11 — `parentPath`, `path`, `name` on `POST /workspaces/:id/files` accept arbitrary strings with no parent existence check

- **Severity:** MEDIUM
- **Location:** `services/workspace/src/routes.ts:228-263`; `services/workspace/src/service.ts:285-330`
- **Evidence:** Body schema permits any non-empty `path`/`name`, no validation that the parent row exists, no name-vs-path consistency check, no length cap.
- **Impact:** Orphan rows in `workspaceFiles`; UI can be confused by entries with `path=/foo/bar` but `parentPath=/baz`. Combined with H6 storage keys can drift from DB paths.
- **Fix:** Enforce `parentPath` existence (or `null` → root), enforce `path === parentPath + '/' + name`, regex-validate name (no `/`, no control chars, length cap).

### M12 — `validateUserFromCookie` logs a substring of the raw session id

- **Severity:** MEDIUM (PII / log hygiene)
- **Location:** `services/workspace/src/service.ts:169` — `this.logger.info({ sessionId: sessionId?.substring(0, 8) + '...' }, ...)`
- **Impact:** Session-id fragments in logs. Combined with verbose logs (pino-pretty in dev), an 8-char prefix reduces brute-force search space and may be enough to correlate users in shared logs.
- **Fix:** Hash the session id (sha256 first 8 chars) before logging, or drop the field entirely.

### M13 — Service-to-service calls today are non-existent: tools simulate, but the architecture rule mandates HTTP/Redis

- **Severity:** MEDIUM (architectural concern that becomes a security one when implemented)
- **Location:** `.cursor/rules/architecture.mdc` mandates "no cross-service DB"; today services do all DB themselves and never call each other (see M9 stubs). When real implementations land, there is no service-auth (mTLS / shared secret / signed JWT) scaffolding.
- **Fix:** Define a service auth pattern (HMAC-signed `X-Internal-Auth` header tied to a per-service secret in env, rotated via SOPs) before the first real cross-service call ships.

---

## LOW

### L1 — README claims a non-existent `apps/api` package and port 4000 gateway

- **Severity:** LOW
- **Location:** `README.md:44, 64, 73-79`
- **Evidence:** `pnpm --filter @pcp/api dev`, "API: http://localhost:4000", `apps/api/   # NestJS gateway`. There is no `apps/api/` directory.
- **Fix:** Update README to list actual ports (auth 3001, workspace 3002, runtime 3003, agent 3004, memory 3005, publish 3006) and delete the gateway claim, or add the gateway.

### L2 — Stale duplicate files in web app and workspace service

- **Severity:** LOW
- **Location:** `apps/web/src/app/(main)/workspace/[id]/page 2.tsx`, `apps/web/src/app/(main)/layout 2.tsx`, `apps/web/src/app/(main)/dashboard/page 2.tsx`, `apps/web/src/app/(main)/dashboard/page 3.tsx`, `apps/web/src/app/(main)/apps/page 2.tsx`, `apps/web/src/components/workspace/file-tree 2.tsx`, `apps/web/src/components/workspace/editor 2.tsx`, `apps/web/src/lib/auth 2.ts`, `services/workspace/src/service 2.ts`, `services/workspace/src/service.test 2.ts`, plus duplicate `apps/web/proxy.ts` vs `apps/web/src/proxy.ts`.
- **Impact:** These ` 2.tsx`/` 3.tsx` files are macOS conflicted-copy artifacts from iCloud/Dropbox sync, all under git. They confuse `tsc`, `next build` (route conflicts) and any code search.
- **Fix:** Delete every `* 2.*` and `* 3.*` file; add `*\ [0-9].*` to `.gitignore`.

### L3 — Env name mismatches between `.env.example` and code

- **Severity:** LOW (becomes HIGH if it hides C2/C7-class fallbacks in prod)
- **Location:** `infra/docker/.env.example` vs the services.
- **Evidence:**
  - `.env.example:23` declares `SESSION_SECRET`; code reads `COOKIE_SECRET` (5 services).
  - `.env.example:27` declares `GOOGLE_REDIRECT_URI`; code reads `GOOGLE_CALLBACK_URL` (`services/auth/src/routes.ts:22`).
  - `.env.example:34` ships `MINIMAX_TOKEN_PLAN_API_KEY`; code also accepts `MINIMAX_API_KEY` (`services/agent/src/llm/provider.ts:17`) but example doesn't list it.
  - `API_URL=http://localhost:4000` (`.env.example:42`) refers to the non-existent gateway (L1).
- **Fix:** Reconcile names; add a single `env.ts` per service that Zod-validates required envs at boot (already done for `@pcp/db` only).

### L4 — `drizzle-orm: "latest"` pin in 4 services

- **Severity:** LOW
- **Location:** `services/memory/package.json:21`, `services/runtime/package.json:23`, `services/agent/package.json:18`, `services/publish/package.json:21`.
- **Impact:** Silent breakage on `pnpm install`; build is non-reproducible despite a lockfile (lockfile bails when registry version drifts).
- **Fix:** Pin to the same `^x.y.z` used in `packages/db` and `services/{auth,workspace}`.

### L5 — Redis and Mailhog provisioned in docker-compose but unused

- **Severity:** LOW
- **Location:** `infra/docker/docker-compose.yml` (Redis, Mailhog services); `grep -rn "redis\|ioredis\|bullmq\|nodemailer" services/` returns no service hits beyond env example.
- **Impact:** Surface area without owner; ports exposed (6379, 8025/1025) without consumers.
- **Fix:** Either wire BullMQ for H9 and Mailhog for verification emails, or drop them from compose until needed.

### L6 — Migrations are sequential but cluttered with auto-generated names; no migration test

- **Severity:** LOW
- **Location:** `packages/db/src/migrations/0000_…sql` … `0007_red_khan.sql`. No CI step that runs migrations against a clean DB.
- **Fix:** Add a CI job that runs `pnpm --filter @pcp/db migrate` against a throwaway pgvector container and asserts schema diff is empty.

### L7 — Vitest version skew (`^4.1.5` in auth/workspace, `^1.4.0` elsewhere)

- **Severity:** LOW
- **Location:** Already documented in repo `AGENTS.md`; package.json files of services confirm.
- **Impact:** Mocks/APIs differ; cross-service test refactors silently break.
- **Fix:** Align on a single major; bump `^1.4.0` services to `^4` after auditing API breaks.

### L8 — `console.error` in agent/publish instead of pino

- **Severity:** LOW (log hygiene; violates `.cursor/rules/backend-standards.mdc`)
- **Location:** `services/agent/src/orchestrator.ts:310, 336`; `services/publish/src/service.ts:61, 143`.
- **Fix:** Use the injected logger; ensure errors are tagged with `correlationId`, `userId`, `service`.

### L9 — `S3WorkspaceObjectStorage` lazily creates bucket on first request and no startup probe

- **Severity:** LOW
- **Location:** `services/workspace/src/service.ts:84-94`
- **Impact:** First user request races to `HeadBucketCommand` + `CreateBucketCommand`; failure mid-flight surfaces as a 500 to the user.
- **Fix:** Probe at startup; expose result in `/health`.

### L10 — `/health` endpoints return only `{status:'ok', service}` — no DB/S3/queue probe

- **Severity:** LOW
- **Location:** Each `services/*/src/index.ts` health handler.
- **Evidence:** `packages/db/src/client.ts:21-30` exposes `checkDbHealth()` but no service uses it.
- **Fix:** Make `/health` (or `/ready`) exercise downstream deps; keep `/live` as a process-only ping.

### L11 — `MAX_TEXT_PREVIEW_BYTES = 256 KB` vs `multipart fileSize: 50 MB` mismatch is undocumented

- **Severity:** LOW
- **Location:** `services/workspace/src/service.ts:13`; `services/workspace/src/index.ts:33-37`.
- **Impact:** UX confusion (uploads succeed, previews silently 413).
- **Fix:** Surface the mismatch in API docs and in the file-listing response so the UI can grey out preview for oversized files.

### L12 — Traefik dashboard exposed at `--api.insecure=true` on `:8080`

- **Severity:** LOW (dev only; would be CRITICAL in prod)
- **Location:** `infra/docker/docker-compose.yml` traefik service command.
- **Fix:** Disable insecure dashboard in production overlay; rely on `--api.dashboard=true` plus middleware-protected entrypoint.

### L13 — Agent `chat` endpoint does not pass userId/system prompt personalization despite `personas`/`userPreferences` schema existing

- **Severity:** LOW (feature gap that cuts the other way — current state is _more_ private than designed, but reveals intended cross-tenant prompt injection surface to plan for).
- **Location:** `services/agent/src/orchestrator.ts:165-174`; schema `packages/db/src/schema/provider_credentials.ts:42-78`.
- **Fix:** When wiring personas, sanitize `systemPrompt` and `rules` before injection; cap length; never echo back to other users.

---

## Cross-cutting summary

- **Top 3 to fix today:** C1 (publish IDOR), C5/H4 (image whitelist + container limits), C2/C3 (cookie secrets).
- **Architectural drift:** `.cursor/rules/architecture.mdc` says "every query filtered by user_id/organization_id" — publish service violates it wholesale (C1); memory service violates it for `workspaceId` (M4); the encrypted secrets store is documented but unimplemented (C7+C8+M10).
- **Pattern of fire-and-forget + console-logged catch (H9, H8, L8) means any single failure mid-task wedges the system silently.** Address with BullMQ, structured logging, and a startup orphan-recovery sweep.
- **Operations tail (L1-L13) is small individually but compounds with the misnamed Next.js middleware (C4) to leave the app feeling protected when the only real auth boundary is the per-service cookie check, which itself relies on a default-fallback secret (C2).**
