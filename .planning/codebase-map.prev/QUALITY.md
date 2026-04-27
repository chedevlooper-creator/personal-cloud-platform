# QUALITY — `personal-cloud-platform`

Re-mapped from scratch. Date: 2026-04-27. All paths relative to repo root.

Severity legend: **HIGH** = ship-blocker / security / silently wrong ; **MED** = correctness or maintainability drag ; **LOW** = polish.

---

## 1. Test coverage per package

Verified by enumerating files matching `*.test.ts|*.spec.ts` outside `node_modules`/`dist`, counting `it(`/`test(`/`describe(` calls, and actually running each suite.

| Package              |  Test files | `it`/`test` blocks | Skipped |       Passing on `pnpm test` | Notes                                                                                                                         |
| -------------------- | ----------: | -----------------: | ------: | ---------------------------: | ----------------------------------------------------------------------------------------------------------------------------- |
| `services/auth`      |           1 |                  7 |   **7** | 0 (suite is `describe.skip`) | Whole suite skipped; comment says "requires live test database".                                                              |
| `services/workspace` | 1 + 1 stale |                  3 |       0 |                         3 ✅ | Real-ish: hoisted db mock + `MemoryStorage` fake. Plus a stale `service.test 2.ts` (also skipped) shipped in the source tree. |
| `services/agent`     |           1 |                  2 |       0 |                         2 ✅ | Pure smoke — both tests are constructor-only (`new AgentOrchestrator(logger)`, `createLLMProvider(...)`).                     |
| `services/memory`    |           1 |                  1 |       0 |   1 ✅ (when run inside dir) | Single smoke test, asserts `service` is defined.                                                                              |
| `services/runtime`   |           0 |                  0 |       0 |                            — | No tests at all. Package declares `"test": "vitest run"` but has no `*.test.ts`.                                              |
| `services/publish`   |           1 |                  4 |       0 |                         4 ✅ | Mocks both `@pcp/db/src/client` and dockerode. Happy-path only — no error / FK / tenant cases.                                |
| `packages/db`        |           0 |                  0 |       — |                            — | No tests; no `test` script.                                                                                                   |
| `packages/shared`    |           0 |                  0 |       — |                            — | No tests; no `test` script.                                                                                                   |
| `apps/web`           |           0 |                  0 |       — |                            — | No tests; no `test` script.                                                                                                   |
| **Totals**           |       **5** |    **17 declared** |   **7** |      **10 substantive runs** |                                                                                                                               |

### What is actually exercised

- **`services/workspace/src/service.test.ts`** is the only suite with non-trivial behavior coverage: starter-file creation, `listFiles` numeric coercion, `getFileContent` rejection of dirs (400) and binary (415). Useful regression net for `WorkspaceService`.
- **`services/publish/test/service.test.ts`** is happy-path with hand-written method-chain mocks; covers `createApp`, `deployApp`, `listApps`, `getDeployments`. Zero error paths, zero tenant-scope assertions.
- **`services/agent/src/orchestrator.test.ts`** + **`services/memory/src/service.test.ts`** are pure construction smoke (~5 minutes of work to write, ~0 regression value).
- **`services/auth/src/service.test.ts`** exists in the file tree but contributes **zero passing assertions** — entire suite is `describe.skip(...)`. Test names suggest it was meant to cover register, login, validateSession, logout against a real Postgres.

### Routes layer (HTTP/Zod) — totally untested everywhere

There are **no integration tests** that boot a Fastify instance and hit a route. Every service’s `routes.ts` (the largest layer, where Zod validation, status codes, cookie auth, `as any` casts, and tenant scoping live) is unverified.

### Coverage estimate per package

Numbers below are eyeballed (no `vitest --coverage` baseline configured). Read them as orders of magnitude.

| Package              |                           Approx line coverage | Approx branch coverage |
| -------------------- | ---------------------------------------------: | ---------------------: |
| `services/auth`      |                                            ~0% |                    ~0% |
| `services/workspace` | ~25–30% (service.ts only; routes.ts untouched) |                   ~15% |
| `services/agent`     |                                            <5% |                    <5% |
| `services/memory`    |                                            <5% |                    ~0% |
| `services/runtime`   |                                             0% |                     0% |
| `services/publish`   |                                           ~30% |                   ~10% |
| `packages/db`        |                                             0% |                     0% |
| `packages/shared`    |                                             0% |                     0% |
| `apps/web`           |                                             0% |                     0% |

**Severity: HIGH.** Backend is essentially un-regression-proofed.

### Test infrastructure fragility (HIGH)

Running `pnpm -r test` from the repo root currently fails non-deterministically because **vitest ≥4 walks upward through the (space-containing) path and picks up a stray `vitest.config.ts` at `/Users/isahamid/Documents/untitled folder/task-chat/vitest.config.ts`** (a parent project on this developer’s machine):

```
services/auth test: failed to load config from /Users/isahamid/.../task-chat/vitest.config.ts
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'vitest' imported from
  /Users/isahamid/.../task-chat/vitest.config.ts.timestamp-...mjs
```

- Reproduces on `services/auth` (vitest@^4.1.5) and intermittently on `services/memory` (vitest@^1.4.0) when run from the workspace root.
- Workaround: each service has no local `vitest.config.ts` of its own. Adding an empty one (`export default defineConfig({})`) per service would pin resolution and make `pnpm -r test` deterministic.
- Also exacerbates the **vitest version split** AGENTS.md already flags: `services/{auth,workspace}` on `^4.1.5`, `services/{agent,memory,publish,runtime}` on `^1.4.0`. Two incompatible runtimes in one repo.

---

## 2. Type safety

`tsconfig.base.json` enforces `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`, `isolatedModules`. Verified per-package with `pnpm --filter <pkg> exec tsc --noEmit`:

| Package              | `tsc --noEmit` exit | Notes                                             |
| -------------------- | ------------------: | ------------------------------------------------- |
| `services/auth`      |                0 ✅ |                                                   |
| `services/workspace` |                0 ✅ | But compiles `src/service 2.ts` (orphan, see §5). |
| `services/runtime`   |                0 ✅ |                                                   |
| `services/agent`     |                0 ✅ |                                                   |
| `services/memory`    |                0 ✅ |                                                   |
| `services/publish`   |                0 ✅ |                                                   |
| `packages/db`        |                0 ✅ |                                                   |
| `packages/shared`    |                0 ✅ |                                                   |
| `apps/web`           |                0 ✅ |                                                   |

**The strict bar is held everywhere. Good.** However the bar is _partially circumvented_ in route handlers (MED): every error response uses `as any` to bypass Zod-derived response typing. Counts of `as any` in non-test source:

| File                                      | `as any` count |
| ----------------------------------------- | -------------: |
| `services/workspace/src/routes.ts`        |             18 |
| `services/agent/src/routes.ts`            |              9 |
| `services/memory/src/routes.ts`           |              5 |
| `services/auth/src/routes.ts`             |              5 |
| `services/runtime/src/routes.ts`          |              6 |
| `services/agent/src/llm/anthropic.ts`     |              4 |
| `services/runtime/src/provider/docker.ts` |              2 |
| `services/workspace/src/service.ts`       |              2 |
| `services/agent/src/llm/openai.ts`        |              1 |
| `services/memory/src/service.ts`          |              1 |
| **Total non-test**                        |        **~53** |

Every `reply.code(401|404).send({ error: '...' } as any)` pattern is a type-system escape hatch. The fix is to add an `errorResponseSchema` to the response map (e.g. `400: errorSchema, 401: errorSchema`).

`.cursor/rules/backend-standards.mdc` explicitly says **"No `any` (use `unknown` if needed)"**. This rule is not being enforced.

`pnpm typecheck` at the root is still a **no-op** (no package defines `typecheck`). AGENTS.md acknowledges this.

---

## 3. Lint / format presence

### Prettier (root)

`.prettierrc` exists (single quotes, semis, width 100, trailing commas). Invoked via `pnpm format`. Not run in CI (no CI config in repo).

### ESLint coverage

Only **2 of 9 packages** have a `lint` script:

| Package                                                | `lint` script | ESLint config present | Result of `pnpm lint`                                                                  |
| ------------------------------------------------------ | ------------- | --------------------- | -------------------------------------------------------------------------------------- |
| `apps/web`                                             | `eslint`      | `eslint.config.mjs`   | **FAIL** — 10 errors, 32 warnings                                                      |
| `packages/db`                                          | `eslint .`    | **none**              | **FAIL** — `ESLint couldn't find an eslint.config.(js\|mjs\|cjs) file` (ESLint 9.39.4) |
| services/{auth,workspace,runtime,agent,memory,publish} | none          | none                  | not invoked                                                                            |
| `packages/shared`                                      | none          | none                  | not invoked                                                                            |

So `pnpm lint` at root currently **always exits non-zero** (apps/web has real errors and `packages/db`'s lint script is broken).

### Frontend lint hotspots (HIGH for editor.tsx, MED for the rest)

`apps/web` lint errors (10):

- `apps/web/src/components/workspace/editor.tsx:49` — `react-hooks/set-state-in-effect`: `setEditedContent(null)` synchronously inside `useEffect` → cascading renders. **Real bug.**
- `apps/web/src/components/workspace/file-tree 2.tsx:27,45` — 2× `@typescript-eslint/no-explicit-any`. (File is a stale dupe — see §5.)
- `apps/web/src/lib/auth 2.ts:29` — `@typescript-eslint/no-explicit-any`. (Stale dupe.)
- 32 unused-import / unused-var warnings spread across `editor.tsx`, `file-tree.tsx`, `terminal.tsx`, etc.

Half of the failures (3 of 10 errors) come from the macOS-duplicated " 2" files documented in §5.

---

## 4. Code duplication

### `validateUserFromCookie` — duplicated 5× (HIGH)

Identical (one variant adds an extra info log) `validateUserFromCookie(sessionId)` lives in:

- `services/agent/src/orchestrator.ts:27`
- `services/memory/src/service.ts:15`
- `services/runtime/src/service.ts:15`
- `services/workspace/src/service.ts:168` (only one with a `logger.info` line about `sessionId.substring(0,8)`)
- `services/workspace/src/service 2.ts:8` (orphan — see §5)

All four read `sessions.findFirst` then `users.findFirst` and return `user.id`. They are **functionally identical** to `services/auth`'s session validator — yet none of the consumer services calls auth via HTTP; they all hit Postgres directly through `@pcp/db`. This violates `.cursor/rules/architecture.mdc` ("No cross-service DB access").

**Fix surface**: lift to `@pcp/shared` or a new `@pcp/auth-client` package, or have services call `GET /auth/session` against the auth service.

### `getAuthenticatedUserId` route helper — duplicated 5× (MED)

```ts
async function getAuthenticatedUserId(sessionId: string | undefined): Promise<string | null> {
  if (!sessionId) return null;
  return <service>.validateUserFromCookie(sessionId);
}
```

Defined verbatim in `agent/routes.ts:11`, `memory/routes.ts:11`, `runtime/routes.ts:11`, `workspace/routes.ts:19`. The agent variant has an extra `AUTH_BYPASS=1 → 'local-dev-user'` branch (`services/agent/src/routes.ts:12`) that the others lack — a divergence that lets agent traffic bypass auth in dev while other services 401, an asymmetry no one ever wants.

### Fastify bootstrap — duplicated 6× (MED, includes a HIGH security issue)

`services/{agent,auth,memory,runtime,workspace}/src/index.ts` are 90% identical: same logger transport block, same CORS, same cookie plugin, same hardcoded fallback secret string:

```ts
secret: process.env.COOKIE_SECRET || 'super-secret-key-replace-in-prod',
```

(`services/publish/src/index.ts` is the lone exception — uses a different idiom and **passes no secret at all** to `cookie`, MED security inconsistency.)

The fallback string is identical across all 5 services. **HIGH**: in any environment where `COOKIE_SECRET` is unset, every service is reading and signing cookies with the same well-known string committed to git — an attacker who reads the source forges sessions trivially. Should be a Zod-validated, fail-fast env at boot.

### 401 reply boilerplate — duplicated ~28× (LOW)

`return reply.code(401).send({ error: 'Unauthorized' } as any);` appears in agent (9), memory (5), runtime (6), workspace (8+). Could be a single `replyUnauthorized(reply)` helper or a Fastify hook/preHandler.

### Shared Zod schemas — actually well centralized (LOW, positive)

`packages/shared/src/{auth,workspace,runtime,agent,memory}.ts` define DTO schemas (16 `z.object` declarations); services consume them via named imports. The few inline `z.object` calls in service `routes.ts` are mostly path/query params or service-local response envelopes — acceptable, not duplication. **No duplicated schemas detected.**

---

## 5. Dead code & junk files

### macOS Finder duplicate files committed to git (HIGH)

`find . -type f -name "* 2.*"` (excluding node_modules/.git/.planning/.agent/.codex) returns **9 files**, every one of them an inadvertent macOS copy that was committed:

```
apps/web/src/lib/auth 2.ts
apps/web/src/app/(main)/layout 2.tsx
apps/web/src/app/(main)/dashboard/page 2.tsx
apps/web/src/app/(main)/apps/page 2.tsx
apps/web/src/app/(main)/workspace/[id]/page 2.tsx
apps/web/src/components/workspace/file-tree 2.tsx
apps/web/src/components/workspace/editor 2.tsx
services/workspace/src/service 2.ts
services/workspace/src/service.test 2.ts
```

Confirmed they ship into compilation: `pnpm --filter @pcp/workspace-service exec tsc --noEmit --listFiles | grep "service 2"` returns the orphan. They also produce 3 of the `apps/web` lint errors. They diverge from their canonical counterparts:

- `services/workspace/src/service 2.ts` is **203 lines** vs `service.ts`'s **528 lines** — an old, smaller, pre-S3 version of `WorkspaceService`.
- `apps/web/src/lib/auth 2.ts` predates the `authApi` extraction and still hardcodes `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'` (a port that does not exist; see §8).

**Action**: `git rm` all 9 files and add `* 2.*` / `* 2` to `.gitignore`.

### Root-level junk

- `DDSD` — empty file at repo root (0 bytes).
- `extract.js` — 320-byte unrelated script at root, not referenced anywhere.

### Schema tables defined but never queried (MED)

Outside of their own schema file and the migration SQL, the following tables have **zero references** in service code (verified by ripgrep over `services/` and `packages/db/src` excluding `migrations/` and the table’s own schema file):

| Table                      | Defined in                             | Queried at runtime?                                                                                           |
| -------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `audit_logs`               | `packages/db/src/schema/audit_logs.ts` | No (auth has a stub `// Failed to write audit log` log line but never inserts).                               |
| `oauth_accounts`           | `oauth_accounts.ts`                    | No (auth uses argon2 path; OAuth callback `services/auth/src/routes.ts:179` never persists provider account). |
| `runtime_logs`             | `runtime_logs.ts`                      | No                                                                                                            |
| `runtime_events`           | `runtime_events.ts`                    | No                                                                                                            |
| `task_steps`               | `task_steps.ts`                        | No (only FK target from `tool_calls`).                                                                        |
| `tool_calls`               | `tool_calls.ts`                        | No (FK target only).                                                                                          |
| `notifications`            | `notifications.ts` (added in 0007)     | No                                                                                                            |
| `provider_credentials`     | `provider_credentials.ts` (0007)       | No                                                                                                            |
| `hosted_services`          | `hosted_services.ts` (0007)            | No                                                                                                            |
| `skills`                   | `skills.ts` (0007)                     | No                                                                                                            |
| `snapshots`                | `snapshots.ts` (0007)                  | No                                                                                                            |
| `terminal_*` (terminal.ts) | `terminal.ts`                          | No                                                                                                            |

**Migration `0007_red_khan.sql` (306 lines, ~7 new tables)** is almost entirely speculative schema — it adds tables that no service currently reads or writes. Either the implementations are pending or these should be removed until needed. Currently they are pure schema debt.

`memory_entries`, `automations`, `conversations`, `runtimes`, `sessions`, `tasks`, `users`, `workspaces`, `workspace_files`, `publish` (`published_apps`, `app_deployments`) **are** queried.

### Dead env vars

None obviously dead. Every `process.env.*` reference resolves to a value consumed at runtime. `OPENAI_API_KEY` (memory), `GOOGLE_*`, `COOKIE_SECRET`, `S3_*`/`MINIO_*`, `REDIS_URL`, `MINIMAX_*`, `AUTH_BYPASS`, `FRONTEND_URL`, `PORT`, `NODE_ENV` all read.

### Dead exports

Not audited exhaustively (would need `ts-prune` or `knip`). Spot-checks of `packages/shared/src/index.ts` show it re-exports five files; all five have at least one importer.

---

## 6. TODO / FIXME / HACK / XXX audit

```
$ rg -n 'TODO|FIXME|HACK|XXX' services packages apps --glob '!node_modules' --glob '!dist'
(no output)
```

**Zero such markers in source.** Two interpretations:

1. The codebase was scrubbed before commit (plausible given the early-stage state).
2. Known shortcuts are simply not annotated. Several places where a TODO would be appropriate but is missing:
   - All five copies of `validateUserFromCookie` (cross-service DB access — explicit rule violation).
   - Hardcoded fallback `'super-secret-key-replace-in-prod'`.
   - `services/auth/src/service.test.ts` `describe.skip` with comment "requires a live test database (Docker is unavailable in the environment)" — should be a TODO/SKIP marker.
   - `services/agent/src/routes.ts:12` `if (process.env.AUTH_BYPASS === '1') return 'local-dev-user';`.
   - Migration 0007 speculative tables.

**Severity: LOW** as a metric, but **MED** as a concern — the absence of markers obscures known debt.

---

## 7. Inconsistencies across services

### Route prefix conventions (MED)

| Service     | Prefix     | Style                                                     |
| ----------- | ---------- | --------------------------------------------------------- |
| `auth`      | `/auth`    | `setupAuthRoutes` + `withTypeProvider<ZodTypeProvider>()` |
| `agent`     | `/api`     | `setupAgentRoutes` + `withTypeProvider`                   |
| `memory`    | `/api`     | `setupMemoryRoutes` + `withTypeProvider`                  |
| `runtime`   | `/api`     | `setupRuntimeRoutes` + `withTypeProvider`                 |
| `workspace` | `/api`     | `setupWorkspaceRoutes` + `withTypeProvider`               |
| `publish`   | `/publish` | `FastifyPluginAsyncZod` (different idiom)                 |

Three different prefix conventions and two different plugin idioms. The `publish` service is the outlier — registers via `FastifyPluginAsyncZod`, doesn’t accept a logger in `PublishService` constructor (other services take `fastify.log`), uses a different `envToLogger` map for pino transport, and registers `cookie` with no secret.

### Naming (MED, vs `.cursor/rules/backend-standards.mdc`)

The cursor rule mandates: kebab-case files, branded types for IDs, no `any`, absolute imports via tsconfig paths.
Reality:

- File names in `packages/db/src/schema/` are `snake_case` (`audit_logs.ts`, `oauth_accounts.ts`, `task_steps.ts`, `tool_calls.ts`, `runtime_events.ts`, `runtime_logs.ts`, `memory_entries.ts`, `provider_credentials.ts`, `hosted_services.ts`, `workspace_files.ts`). All other source files are `camelCase` or single-word.
- No branded types anywhere — every ID is `z.string().uuid()` and a plain `string`.
- ~53 `as any` casts in production code.
- No tsconfig `paths` — services use relative imports + workspace package names.

### Error response shape (LOW, but unenforced)

`{ error: string }` is used consistently in 401/404 replies, but it is **never declared as a Zod response schema** — hence the `as any` casts. There is no `errorResponseSchema` in `@pcp/shared`. Adding one would eliminate the casts and document the wire contract.

### Auth bypass asymmetry (HIGH for prod misconfig risk)

Only `services/agent/src/routes.ts:12` honors `AUTH_BYPASS=1`. If that env leaks into production for the agent service alone, agent endpoints are open while everything else stays guarded — easy to overlook in a config review.

### Env loading (MED)

Only `services/agent/src/env.ts` loads `.env` files manually (custom dotenv-lite walking up to `pnpm-workspace.yaml`). Other services rely on docker-compose or shell-injected env. No service uses Zod to validate env at boot, despite `.cursor/rules/architecture.mdc` mandating "Config via env, validated with Zod at startup".

---

## 8. Migration / schema hygiene

### Linearity & integrity (LOW — clean)

8 migrations 0000–0007. `_journal.json` entries match files 1:1 with monotonically increasing `idx` and `when` timestamps:

```
0000_majestic_the_fury        when=1777175933861
0001_giant_the_anarchist      when=1777177363648
0002_condemned_namora         when=1777177913823
0003_silky_thor               when=1777178510266
0004_freezing_otto_octavius   when=1777179614285
0005_nifty_ulik               when=1777180762271
0006_brown_nekra              when=1777182604153
0007_red_khan                 when=1777235765626
```

No gaps, no duplicates, no out-of-order timestamps. Snapshot JSONs all present. **No evidence of manual SQL edits** — generation pattern (`statement-breakpoint` markers, FK constraint formatting) is consistent across all 8 files.

### Schema debt (MED)

See §5: migration `0007_red_khan.sql` adds 7 tables (notifications, provider_credentials, hosted_services, skills, snapshots, etc.) that have zero runtime queries. Schema is running ahead of implementation. These tables consume migration history forever and any rollback gets harder with every additional migration that references them.

---

## 9. Documentation hygiene

### `README.md` — STALE (HIGH for new-contributor onboarding)

Multiple incorrect claims:

| Line                   | Claim                         | Reality                                                                                                     |
| ---------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `## Project Structure` | `apps/api/  # NestJS gateway` | No `apps/api` directory exists; no NestJS dependency anywhere.                                              |
| `Quick Start`          | `pnpm --filter @pcp/auth dev` | Package name is `@pcp/auth-service`, not `@pcp/auth`. Command fails.                                        |
| `Quick Start`          | `pnpm --filter @pcp/api dev`  | No such package.                                                                                            |
| `Quick Start`          | `pnpm --filter @pcp/web dev`  | Web package is named `web`, not `@pcp/web`. Correct: `pnpm --filter web dev`.                               |
| `Access`               | `API: http://localhost:4000`  | No service listens on 4000. Auth=3001, workspace=3002, runtime=3003, agent=3004, memory=3005, publish=3006. |

`AGENTS.md` already documents this ("README's 'API at :4000' and 'apps/api' references are stale; ignore them"), but the README itself has not been updated.

### `AGENTS.md` (root) — ACCURATE (LOW)

Verified claim-by-claim: pnpm version, Node version, package layout, vitest version split, "no apps/api", `pnpm typecheck` no-op, `packages/shared` has no build step, pgvector requirement, `.gitignore` excludes `infra/docker/.env`. All accurate.

### `apps/web/AGENTS.md` — ACCURATE (LOW)

5 lines, one claim ("Next.js 16 + React 19, breaking changes vs training data"). Confirmed — `next@16.2.4`, `react@19.2.4`. Accurate.

### `.cursor/rules/*.mdc` — DRIFTED (MED)

8 rule files (`architecture, backend-standards, database, security, sandbox, testing, frontend, agents`). Spot-checked `backend-standards.mdc` and `architecture.mdc`:

- `backend-standards.mdc` glob `["services/**/*.ts", "apps/api/**/*.ts", "packages/**/*.ts"]` — `apps/api/**` doesn't exist.
- Says "No `any`" — codebase has 53 `as any` in production code.
- Says "kebab-case for files" — `packages/db/src/schema/*.ts` use snake_case for 10 of 22 files.
- Says "Branded types for IDs (UserId, WorkspaceId)" — none exist.
- Says "Absolute imports via tsconfig paths" — no `paths` configured.
- `architecture.mdc` says "No cross-service DB access — services talk over HTTP / Redis pub/sub / BullMQ" — contradicted by every consumer-of-auth service running its own `validateUserFromCookie` against Postgres directly.

The rules describe an aspirational architecture, not the current code.

---

## 10. Observability

### Logging (MED — inconsistent and PII-leaking)

- pino is used everywhere — good. 6 services pass `fastify.log` into their service constructor (`new XService(fastify.log)`). `services/publish` is the exception: `new PublishService()` takes no logger.
- **`correlationId` field: 0 occurrences** repo-wide. Cursor rule (`architecture.mdc`) explicitly mandates "Logging is pino JSON with `correlationId, userId, service`". Not implemented.
- Logger fields are inconsistent:
  - `services/auth/src/service.ts:25` — `this.logger.info({ email }, 'Registering new user')` and `:52` `'User login attempt'` — **logs raw email (PII) in plaintext**. Violates same rule (`no PII`). **HIGH for compliance.**
  - `services/workspace/src/service.ts:169` — logs first 8 chars of `sessionId` (better, but ad-hoc).
  - Others either log nothing structured or just an `err`.
- No request-id middleware on any Fastify instance. Fastify auto-assigns `reqId` per request but none of the service code ever forwards it as `correlationId` to downstream calls.

### Error responses (MED)

- All error sends are `{ error: string }`, no error code, no machine-readable type, no `requestId` echoed back. Hard to correlate a 500 in user logs to a server-side log line.
- All happy-path error responses go through `reply.code(N).send(...)` with `as any`. Exception-thrown errors fall through Fastify’s default JSON error handler — output shape differs from manually-sent ones.
- `services/workspace/src/service.ts` defines a `WorkspaceError extends Error` class with `statusCode` (used by tests on lines 199, 218); routes do not have a handler that translates it to an HTTP status — so a thrown `WorkspaceError(... 415)` would currently surface as a generic 500. (Verified by reading routes.ts — no `setErrorHandler`.)

### Health endpoints (LOW — consistent)

All six services expose `GET /health → { status: 'ok', service: '<name>' }`. The single thing the services agree on.

---

## 11. Severity-ranked summary

### HIGH

1. **Hardcoded fallback cookie secret** (`'super-secret-key-replace-in-prod'`) committed in 5 service entry points; identical across services. — `services/{agent,auth,memory,runtime,workspace}/src/index.ts`
2. **PII in logs**: `services/auth/src/service.ts:25,52` log raw email.
3. **9 macOS-duplicate files** committed to git, two of which are full-fledged divergent code (`services/workspace/src/service 2.ts`, `apps/web/src/lib/auth 2.ts`) that compile into output. They also generate 3 lint errors.
4. **Test coverage near zero**: only ~10 substantive tests across the entire repo; auth suite 100% skipped; routes layer untested everywhere; `services/runtime` has no test file at all.
5. **Test infrastructure brittle**: `pnpm -r test` non-deterministically picks up a parent-directory `vitest.config.ts` and crashes auth/memory.
6. **README.md is misleading enough to break onboarding** (`@pcp/api`, `@pcp/web`, `apps/api`, port 4000 — none exist).
7. **`AUTH_BYPASS=1` is honored only by agent**, asymmetric attack surface in misconfigured envs.
8. **Real React bug** in `apps/web/src/components/workspace/editor.tsx:49` — synchronous `setState` in `useEffect` (cascading renders).
9. **Cross-service DB access** violates `.cursor/rules/architecture.mdc`: 4 services run their own `validateUserFromCookie` against Postgres instead of calling auth.

### MED

10. ~53 `as any` casts in production code defeat the otherwise-strict TS bar (and contradict `backend-standards.mdc`).
11. Lint coverage is 2 of 9 packages; `packages/db` lint script is broken (no eslint config); 6 services have no lint config at all.
12. Migration `0007_red_khan.sql` introduces 7 tables (~306 lines of SQL) that are not queried anywhere — speculative schema debt.
13. 12 schema tables defined but never read/written at runtime (audit*logs, oauth_accounts, runtime_logs, runtime_events, notifications, hosted_services, skills, snapshots, provider_credentials, terminal*\*, task_steps, tool_calls).
14. **No `correlationId` / `requestId` in any log line**, despite mandate.
15. Service bootstrap (`index.ts`) duplicated across 6 services with subtle divergences (publish has no cookie secret, no logger in service ctor, different prefix idiom).
16. Route prefix inconsistency: `/api` (4×), `/auth` (1×), `/publish` (1×) — frontend must hardcode each.
17. `WorkspaceError` is thrown but no `setErrorHandler` translates `statusCode` — thrown errors become 500.
18. Vitest version split (`^4.1.5` vs `^1.4.0`) — two incompatible test runtimes.
19. `.cursor/rules/*.mdc` describes an aspirational architecture (kebab-case, branded IDs, no any, absolute imports, HTTP between services, env-validated-by-Zod). Reality matches none of these.
20. Auth uses argon2/password flow (`services/auth/src/service.ts`) but OAuth callback at `services/auth/src/routes.ts:179` never persists to `oauth_accounts` — feature half-built.
21. No env validation at boot in any service (Zod `.parse(process.env)` absent).
22. Zero TODO/FIXME markers despite obvious shortcuts — debt is unannotated.

### LOW

23. Root-level junk: empty `DDSD` file, unused `extract.js`.
24. 32 unused-import warnings in `apps/web`.
25. Error response shape is consistent (`{ error }`) but never declared as a Zod schema in `@pcp/shared`.
26. `packages/db/package.json` declares `"lint": "eslint ."` but has no ESLint config — script will always fail.
27. `services/runtime/package.json` declares `"test": "vitest run"` but ships no `*.test.ts` — script always passes vacuously.
28. `pnpm typecheck` at root is a no-op (acknowledged in AGENTS.md).
29. 401 reply boilerplate duplicated ~28 times — single `replyUnauthorized()` helper would consolidate.

---

## Appendix A — Reproduction commands

```bash
# Test counts
find services packages apps -type f \( -name "*.test.ts" -o -name "*.spec.ts" \) -not -path "*/node_modules/*"

# Per-service typecheck (all PASS)
for p in @pcp/auth-service @pcp/workspace-service @pcp/runtime-service @pcp/agent-service \
         @pcp/memory-service @pcp/publish-service @pcp/db web; do
  pnpm --filter "$p" exec tsc --noEmit && echo "$p OK"
done

# `as any` audit
rg -c 'as any' services packages apps --glob '!node_modules' --glob '!dist' --glob '!*.test.ts'

# validateUserFromCookie duplication
rg -n 'validateUserFromCookie' services

# Hardcoded cookie secret
rg -n "super-secret-key-replace-in-prod" services

# macOS dupes
find . -type f -name "* 2.*" -not -path "*/node_modules/*" -not -path "*/.git/*"

# Schema vs query usage
for s in audit_logs oauth_accounts runtime_logs runtime_events notifications hosted_services \
         skills snapshots provider_credentials task_steps tool_calls; do
  echo "$s: $(rg -l "\b${s}\b" services packages --glob '!node_modules' \
    --glob '!schema/*.ts' --glob '!migrations/*' 2>/dev/null | wc -l)"
done

# README staleness
rg -n 'apps/api|@pcp/api|@pcp/auth\b|@pcp/web|localhost:4000' README.md
```
