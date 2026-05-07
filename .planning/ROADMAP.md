# ROADMAP.md — CloudMind OS v0.1 → Production-Readiness

> 7 phases. Coarse granularity. Audit-derived. Brownfield.
>
> Goal: bring the existing alpha to a state where a real user can be onboarded without leaking, crashing, or escaping the sandbox.

## Phases

### Phase 1: Error Envelope Hardening
**Goal:** All services return typed error envelopes with no upstream/driver leakage.
**Requirements:** SEC-01, SEC-02
**Success criteria:**
- A `DomainError` (or equivalent) hierarchy exists in `@pcp/shared` and is used by all 7 services.
- No route returns a raw `Error.message` containing `pg`, `drizzle`, `redis`, `MinIO`, or stack traces.
- Tests cover at least one error path per service that confirms the public envelope.
- Existing `toastApiError` consumer remains the single frontend sink and renders new envelopes.

### Phase 2: Auth Normalization
**Goal:** Internal service-to-service auth is scoped; workspace routes use one auth helper.
**Requirements:** SEC-03, SEC-04
**Success criteria:**
- Internal token has an `aud` claim verified per service (no shared blanket token).
- Workspace routes use a single `requireUser`-style helper — no inline header parsing.
- Removing the helper from one route causes a typecheck or test failure.
- Audit log records service-to-service calls with correct `aud`.

### Phase 3: Real Settings Forms
**Goal:** Settings panels are API-backed forms, not local state placeholders, and work on mobile.
**Requirements:** UX-02
**Success criteria:**
- Profile / API keys / preferences / billing-stub pages each POST to a real endpoint.
- Optimistic UI + error toast via `toastApiError` on failure.
- Layout passes manual mobile check at 375 px width (no horizontal scroll, no overlap).
- A Playwright smoke test asserts a settings save survives a reload.

### Phase 4: Automations & Hosting UX
**Goal:** Destructive actions are confirmed; users can see what their automations and hosted services actually did.
**Requirements:** UX-03, UX-04
**Success criteria:**
- Delete/run-now actions in Automations + Hosting open a confirm dialog.
- Automations page shows a real run history (status, started_at, duration, error preview) sourced from BullMQ + DB.
- Hosting page shows service detail (image, ports, env vars), logs tail, and env-var validation prior to deploy.
- Manual QA: stopping/restarting a hosted service from the UI reflects state within 5 s.

### Phase 5: Tenant Isolation Backstop
**Goal:** Tenant isolation does not depend on application code alone.
**Requirements:** SEC-06
**Success criteria:**
- A decision recorded (RLS vs. audit-tests-only) with rationale in `.planning/decisions/`.
- If RLS: enabled on all tenant-scoped tables with policies tested via dedicated SQL fixtures.
- If audit-tests-only: a generated test suite asserts every repository function filters by `user_id` or `organization_id` via static analysis or runtime probe.
- A red-team test attempts cross-tenant access via a forged JWT and is rejected.

### Phase 6: Runtime Sandbox Regression
**Goal:** Tightened command policy with regressions caught before merge.
**Requirements:** SEC-08
**Success criteria:**
- Runtime + publish command allow/deny policy documented in `infra/docker/POLICY.md`.
- Strict / balanced / permissive profiles each have a regression test that asserts blocked commands stay blocked.
- Custom seccomp profile diffed and reviewed; any new syscalls justified inline.
- A CI job runs the sandbox regression suite on every PR touching `services/runtime` or `services/publish`.

### Phase 7: Cleanup, Docs, Smoke, Mobile, A11y
**Goal:** Catch the rest of the audit's P1 items in a single sweep.
**Requirements:** SEC-05, SEC-07, UX-01, UX-05, UX-06, UX-07, INF-01, INF-02, INF-03
**Success criteria:**
- README rewritten and verified — no stale `apps/api`/`:4000` references; matches `AGENTS.md`.
- Playwright covers top-3 flows: login → workspace open, send chat with tool call, deploy a static site.
- `normalizeProfileValue` exists once in `@pcp/shared`; runtime/publish import from there.
- Chat shell uses provider state — `app:attach-file-to-chat` etc. retained only for cross-tree dispatch, not toggle loops.
- Files page + admin pages tested at 375 px and 768 px; tabbing reaches every interactive control.
- Static audit keeps route-level `@pcp/db` access in a reviewed inventory so unreviewed direct DB work fails tests.
- Redis-capable rate limiter protects auth + agent endpoints with configuration tests covering distributed mode.

## Phase ordering rationale

1. Error envelopes first — every later phase benefits from typed errors.
2. Auth normalization — required before tightening tenant isolation.
3. Settings before Automations/Hosting — settings is shallower, derisks form patterns.
4. Automations + Hosting together — same confirm-dialog primitives, both write-heavy.
5. Tenant isolation backstop — needs Phase 2's auth scoping in place.
6. Sandbox regression — independent but logically grouped after isolation.
7. Cleanup sweep — small items consolidated to avoid 5 micro-phases.

---
*Last updated: 2026-05-08 after Phase 7 completion.*
