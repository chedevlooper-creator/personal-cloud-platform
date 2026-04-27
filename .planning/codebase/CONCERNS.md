# Concerns

Production-readiness gaps, technical debt, and known risks across the CloudMind OS codebase. Severity reflects impact on the **Core Value** ("safely run and automate useful work without leaking tenant data, credentials, or host resources").

## Security

### CRITICAL — Sandbox host escape risk
- `services/runtime` and `services/publish` use `dockerode` against the host Docker socket. Without strict resource limits, seccomp/apparmor profiles, and a non-root container user, a tenant container can compromise the host.
- Mitigation hint: enforce `--read-only`, drop capabilities, set CPU/memory/pids limits, isolate per-tenant networks. See `.cursor/rules/sandbox.mdc`.

### CRITICAL — Tenant scoping uneven
- Repo rules require every query to filter by `user_id` / `organization_id` and tenant-prefix all storage paths.
- Audit: services accept `userId` arg but coverage is inconsistent — some service methods rely on caller correctness rather than enforcing scope at the repo layer.

### HIGH — Auth/session implementation duplicated
- Cookie-session validation is duplicated across services using direct DB reads. Drift between services can produce inconsistent authn.
- Suggested move: extract a shared session validator (in `@pcp/shared` or a thin client) to centralize the contract.

### HIGH — Fallback dummy secrets at startup
- Several services use raw `process.env` with fallback default/dummy secret values instead of failing fast under Zod validation.
- Risk: production boot with placeholder secrets. Pattern to follow: `packages/db/src/client.ts`.

### HIGH — `as any` and `z.any()` casts in routes
- Multiple routes short-circuit responses via `as any` or accept `z.any()` payloads, defeating type-driven validation.
- Risk: malformed input reaches services; refactors silently break contracts.

### MEDIUM — PII / secret leakage in logs
- Some code paths use `console.error` instead of pino with the prescribed `correlationId, userId, service` fields.
- Repo rule: no PII or secrets in logs.

### MEDIUM — Error envelope inconsistency
- Routes mix `{ error: string }` shapes and ad-hoc statuses. `WorkspaceError` exists in workspace service but isn't applied broadly.
- Risk: clients can't reliably parse failures; internals leak through stack messages.

## Reliability

### HIGH — Agent durability
- `services/agent` orchestration uses BullMQ for automations but agent task progress and tool-call state durability is incomplete (comments mark simulated/MVP behavior).
- Risk: process crash mid-task loses user-visible progress and may double-execute tools on resume.

### MEDIUM — No consistent retry/backoff
- LLM provider calls and Docker operations don't share a retry/backoff abstraction. Provider blips bubble as 5xx.

### MEDIUM — No graceful shutdown discipline
- Services don't uniformly drain in-flight requests, queue jobs, or active container streams on `SIGTERM`.

## Test Coverage

### HIGH — Critical surfaces lack tests
- `apps/web` and `packages/shared` have no tests.
- Coverage on services is uneven; `services/auth` and `services/workspace` are best-covered (and pin `vitest@^4.1.5`); others on `^1.4.0` with thinner suites.
- E2E / integration tests across services are absent.

### MEDIUM — Mixed Vitest versions
- `services/auth` and `services/workspace` are on `vitest@^4.1.5`; rest on `^1.4.0`. APIs differ — don't unify casually without a coordinated upgrade.

## Architecture / Layering

### MEDIUM — Service layering not enforced
- Repo rule: `repository → service → route`. Several services have large service classes that own both DB access and business logic, with routes constructing services directly.
- Risk: hard to test, hard to swap providers, tenant checks scattered.

### MEDIUM — Services import DB internals
- Services import from `@pcp/db/src/...` (not a public barrel). Drizzle internals leak into business logic.

### LOW — `packages/shared` has no build
- Consumers import directly from `src/`. Don't add `"build"` expectations or `dist/` references — would break the workspace.

## Documentation

### MEDIUM — README is stale
- README references `apps/api` (does not exist) and "API at :4000". Backend is split across `services/*`; new contributors are misled.
- Trust executable config and `.cursor/rules/*.mdc` over README prose.

### LOW — TODO/MVP comments survive without tickets
- Comments mark simulated/incomplete behavior in agent and automation flows without owner or ticket reference.

## Operations / Deployment

### HIGH — `.env` discipline
- `infra/docker/.env` is gitignored (correct) but several services depend on it without explicit production guidance for managed equivalents.
- Production target: managed Postgres (with pgvector), managed Redis, S3-compatible storage, explicit secret manager.

### MEDIUM — No migration gating
- DB migration steps documented but not automated in a deployment pipeline. Risk of running services against stale schema.

### LOW — Path with spaces
- Repo path contains spaces. Always quote paths in shell commands or scripts that touch the workspace root.

## Frontend

### MEDIUM — Next.js 16 + React 19 drift
- Training data lags actual API. Always consult `apps/web/node_modules/next/dist/docs/` before routing/server-component/config changes.

### LOW — Tailwind v4 + shadcn theming
- Theme tokens centralized in `apps/web/src/app/globals.css`. Don't fork tokens per-component.

---

## Severity Summary

| Severity | Count | Examples |
|----------|-------|----------|
| CRITICAL | 2 | Sandbox host escape, tenant scoping audit |
| HIGH | 6 | Session duplication, fallback secrets, type casts, agent durability, test gaps, env discipline |
| MEDIUM | 9 | Logging fields, error envelopes, retries, shutdown, layering, DB internals, README, migration gating, Next.js drift |
| LOW | 4 | `packages/shared` build, TODO discipline, path spaces, theme drift |

## Cross-cutting Themes
1. **Tenant safety** is the dominant axis — sandboxing, scoping, and secret handling cluster here.
2. **Type-system bypasses** (`as any`, `z.any()`, fallback secrets) erode the strictness `tsconfig.base.json` is configured to enforce.
3. **Observability + error contract** are uneven — pino fields and error envelopes need standardization before scale.
4. **Test coverage** must precede production-readiness work to avoid regressions during hardening.
