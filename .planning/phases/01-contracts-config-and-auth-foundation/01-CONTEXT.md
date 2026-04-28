# Phase 1: Contracts, Config, And Auth Foundation - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase makes service startup, auth/session validation, API errors, shared
DTO contracts, logging, health, and shutdown behavior consistent enough for
later security and sandbox hardening work. It does not attempt to audit every
tenant-scoped query, rewrite service architecture, or add new product modules.
Those belong to later phases.

</domain>

<decisions>
## Implementation Decisions

### Session Validation Contract
- **D-01:** Prefer extracting one shared session validation contract/helper over
  continuing divergent per-service cookie/session reads.
- **D-02:** The first implementation may be a thin shared internal helper or
  package-level module, but it must preserve the existing HTTP-only cookie
  session model and not introduce JWT auth.
- **D-03:** Services must fail closed when session validation cannot prove a
  user, and route handlers should not rely on caller-only checks for protected
  routes.

### Environment Validation
- **D-04:** Follow the `packages/db/src/client.ts` pattern: Zod-validated env
  parsing at startup with clear failure modes.
- **D-05:** Production must reject development markers and invalid secrets,
  especially `COOKIE_SECRET` and `ENCRYPTION_KEY`.
- **D-06:** Local development convenience can remain, but unsafe defaults must
  not silently boot in production.

### API Errors And DTO Contracts
- **D-07:** Introduce a consistent service error envelope through Fastify
  error handlers before deeper route cleanup.
- **D-08:** Route schemas should use `@pcp/shared` DTOs where contracts cross
  service/frontend boundaries.
- **D-09:** Avoid adding new `any`, `as any`, and broad `z.any()` bypasses. If a
  temporary boundary is genuinely unknown, narrow it immediately and document why.

### Logging, Health, And Shutdown
- **D-10:** Pino logs should consistently include `correlationId`, `userId`, and
  `service` where available.
- **D-11:** Logs must redact secrets, API keys, plaintext credentials, and PII.
- **D-12:** Health checks and graceful shutdown should be normalized enough that
  later CI/smoke and deployment work can rely on them.

### the agent's Discretion
- Exact helper/module location for shared session validation, as long as it
  respects existing package boundaries and does not add a build step to
  `@pcp/shared`.
- Exact error code names and envelope field names, provided they are consistent
  across touched services and easy for the frontend to consume.
- Whether to update every service in one plan or split by service groups during
  planning.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Scope
- `.planning/PROJECT.md` - Core value, active requirements, constraints, and
  key decisions for the production-readiness milestone.
- `.planning/REQUIREMENTS.md` - Requirement IDs mapped to Phase 1.
- `.planning/ROADMAP.md` - Phase boundary, success criteria, and planned work.
- `.planning/STATE.md` - Current GSD position and known workflow caveats.

### Existing Documentation
- `AGENTS.md` - Repo-specific invariants, commands, GSD workflow enforcement,
  and stale-doc guidance.
- `CLAUDE.md` - Service architecture, critical invariants, and gotchas.
- `README.md` - Current architecture overview, commands, infra, and security
  model.
- `docs/PROGRESS.md` - Current shipped/open-work status snapshot.
- `docs/PRODUCTION.md` - Production deployment and hardening checklist.
- `docs/DATA_MODEL.md` - Tenant scoping, encryption, and state machine
  references.

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` - Layering, service pattern, and
  cross-cutting concerns.
- `.planning/codebase/STACK.md` - Runtime/framework/dependency and config
  details; verify against executable config where stale.
- `.planning/codebase/CONCERNS.md` - Production-readiness risks this phase
  starts addressing.
- `.planning/codebase/CONVENTIONS.md` - TypeScript, validation, logging, error,
  and frontend conventions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/db/src/client.ts`: Canonical Zod env validation pattern to replicate
  or adapt for services.
- `@pcp/shared/src/*`: Existing DTO home for cross-service/frontend contracts;
  keep it source-only.
- Service `src/env.ts` files: Natural targets for startup validation tightening.
- Fastify service entries in `services/*/src/index.ts`: Natural place for shared
  logger/error/health/shutdown wiring.

### Established Patterns
- Services are Fastify v4 with `fastify-type-provider-zod`, pino logging, and
  route/service layering.
- Auth is session-cookie based with direct DB-backed session reads today.
- Root scripts already include typecheck for all packages and test for all
  services, including `browser-service`.
- Frontend imports service clients directly; error envelope changes must remain
  frontend-consumable.

### Integration Points
- Auth/session validation touches `services/*/src/auth.ts` or route-local auth
  helpers where present.
- Env validation touches `services/*/src/env.ts`, service entry files, and
  package scripts where startup order matters.
- Error envelope work touches Fastify setup, route handlers, shared DTOs, and
  frontend API error handling if needed.
- Logging normalization touches Fastify logger configuration and request-scoped
  context propagation.

</code_context>

<specifics>
## Specific Ideas

- Treat this as foundational hardening: later tenant isolation, sandbox, agent,
  and CI phases should be able to depend on the contracts created here.
- Keep edits surgical and service-aligned; do not use this phase as a broad
  architecture rewrite.
- Resolve documentation conflicts by checking package scripts and source code
  before implementing.

</specifics>

<deferred>
## Deferred Ideas

- Full tenant-scoping audit belongs to Phase 2.
- Docker seccomp/AppArmor and runtime resource limits belong to Phase 3.
- Agent task durability, streaming, telemetry, and memory indexing belong to
  Phase 4.
- CI, metrics, tracing, and frontend accessibility/i18n polish belong to
  Phase 5.

</deferred>

---

*Phase: 01-contracts-config-and-auth-foundation*
*Context gathered: 2026-04-28*
