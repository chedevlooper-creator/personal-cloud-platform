# Concerns

> Cross-domain risks blocking production-readiness, sourced from `2026-05-02-cloudmind-superpowers-gap-audit.md` and graphify findings.
> Last updated: 2026-05-06

## P1 — Backend & Security

### B1. Domain errors become 500s
Services throw plain `Error` for not-found / client-correctable cases. Frontend cannot distinguish recoverable vs. server failures.
- **Evidence:** `packages/shared/src/errors.ts`, `services/runtime/src/service.ts`, `services/publish/src/service.ts`, `services/agent/src/orchestrator.ts`
- **Risk:** Misleading UX; users see "server error" for their own input mistakes.
- **Fix slice:** Define typed error classes (NotFound, BadRequest, Forbidden) in `@pcp/shared`, add route-level mappers + regression tests.

### B2. Internal route catches leak details
Custom catch paths surface driver/upstream messages.
- **Evidence:** `services/browser/src/routes.ts`, `services/workspace/src/routes/datasets.ts`
- **Risk:** Information disclosure (DB schema, internal hostnames).
- **Fix slice:** Route-level error envelope hardening + regression tests.

### B3. Internal service token + arbitrary `X-User-Id` = impersonation
Any caller with the internal token can act as any user.
- **Evidence:** `packages/db/src/auth-request.ts`, `services/agent/src/clients/http.ts`, `services/runtime/src/workspaceClient.ts`
- **Risk:** Token compromise → full cross-user blast radius.
- **Fix slice:** Audience/service scoping on tokens, rotation path, document network boundary.

### B4. Auth resolution inconsistent across workspace routes
Snapshot routes don't use the central auth helper.
- **Evidence:** `services/workspace/src/routes.ts`, `services/workspace/src/routes/snapshots.ts`
- **Risk:** New routes diverge silently; future bypass.
- **Fix slice:** Normalize all workspace routes onto the central helper.

### B5. Routes do direct DB work (layering leak)
- **Evidence:** `services/auth/src/routes/profile.ts`, `services/auth/src/routes/admin.ts`, `services/agent/src/routes/automation.ts`
- **Risk:** Tenant filtering audited per-route, not centrally; business logic in HTTP layer.
- **Fix slice:** Move DB calls to repository, route only validates + delegates.

### B6. Tenant isolation has no DB backstop
App-level filtering only.
- **Evidence:** `packages/db/src/schema/*`, `packages/db/src/migrations/*`
- **Risk:** A single missed `where(userId)` leaks data across tenants.
- **Fix slice:** Evaluate Postgres RLS; minimum: targeted tenant-query audit tests.

### B7. Rate limiting per-process
- **Evidence:** `services/workspace/src/index.ts`, `services/agent/src/rate-limit.ts`, `packages/shared/src/rate-limit.ts`
- **Risk:** Limits leak with horizontal scaling; abuse window opens.
- **Fix slice:** Distributed Redis-backed limiter; fail-closed on Redis unavailability.

### B8. Runtime/publish command surface broad
Approved shell commands and hosted start commands carry escape risk.
- **Evidence:** `services/runtime/src/policy.ts`, `services/agent/src/tools/run_command.ts`, `services/publish/src/service.ts`
- **Risk:** Sandbox escape, host compromise from tenant code.
- **Fix slice:** Tighten policy, add sandbox regression tests, document escape model.

## P1 — Frontend & UX

### F1. Global chat actions wired through unreliable custom events
- **Evidence:** `apps/web/src/components/app-shell/main-canvas.tsx`, `apps/web/src/components/app-shell/keyboard-shortcut-provider.tsx`
- **Risk:** Header/shortcut/command-palette actions can fail or loop; degrades core feature (Chat).
- **Fix slice:** Wire shell actions directly to `ChatPanelProvider` state.

### F2. Settings panels are no-ops
Profile/model/storage/account look interactive but don't persist.
- **Evidence:** `apps/web/src/app/(main)/settings/page.tsx`
- **Risk:** Users believe actions worked; data integrity illusion.
- **Fix slice:** Convert to API-backed forms with mobile tab layout.

### F3. Automations: destructive actions without confirm; no real run history
- **Evidence:** `apps/web/src/app/(main)/automations/page.tsx`, `apps/web/src/components/automations/create-automation-dialog.tsx`
- **Risk:** Accidental deletion; users can't debug failed runs.
- **Fix slice:** Confirm dialog, row pending state, inline validation, real run history view.

### F4. Hosting lacks detail/logs/deploy diagnostics
Invalid env lines silently ignored.
- **Evidence:** `apps/web/src/app/(main)/hosting/page.tsx`
- **Risk:** Users can't debug deploy failures.
- **Fix slice:** Service detail view, logs/status history, env validation feedback.

### F5. Admin pages mask API failures as empty
- **Evidence:** `apps/web/src/app/(main)/admin/page.tsx`
- **Risk:** Permission/service failures look like no data.
- **Fix slice:** Error states, responsive table/card layouts.

### F6. Files page broken on mobile
Tree hidden below `lg`; user can land in editor with no file selection path.
- **Evidence:** `apps/web/src/app/(main)/files/page.tsx`, `apps/web/src/components/workspace/editor.tsx`
- **Risk:** Mobile users can't navigate.
- **Fix slice:** Mobile file picker / drawer.

### F7. Custom + hover-only controls fail keyboard/touch
- **Evidence:** `apps/web/src/components/ui/confirm-dialog.tsx`, `apps/web/src/components/chat/chat-core.tsx`
- **Risk:** Accessibility blockers; legal/UX failure.
- **Fix slice:** Replace with accessible dialog primitives, visible focusable actions.

## P1 — Infra, Tests, Docs

### I1. README is stale
References `apps/api`, port 4000, `/health` curl — none real.
- **Risk:** New contributors are misled; onboarding fails.
- **Fix slice:** Rewrite README from current AGENTS.md + ARCHITECTURE.md.

### I2. Frontend has no tests
- **Risk:** UI regressions ship silently; auth/chat critical paths untested.
- **Fix slice:** Playwright (already in devDeps) for top-3 flows: login → workspace → chat.

### I3. Code duplication: `normalizeProfileValue`
Defined separately in runtime and publish policies.
- **Risk:** Drift; one fixed, the other stays buggy.
- **Fix slice:** Lift to `@pcp/shared`, both services import.

### I4. Vitest version drift acknowledged
`auth`, `workspace` on v4; rest on v1. Intentional. Documented in AGENTS.md but not in CI.
- **Risk:** Low; flagged here so accidental "unify versions" PRs get rejected.

## What's NOT a concern (graphify false alarms)

- `start()` cross-service hub — node-ID collision artifact, not real wiring.
- `publish → agent.setupAutomationWorker()` — phantom edge, no real call.
- `runtime → publish.normalizeProfileValue()` — same-name, different functions; not a real call (but see I3 for the real duplication concern).

## Out of Scope (now)

- Multi-region deploy
- SSO (SAML / Okta)
- Mobile native apps
- Kubernetes migration (Docker Compose is sufficient for current scale)
