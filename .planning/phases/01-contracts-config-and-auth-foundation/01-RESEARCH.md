# Phase 1: Contracts, Config, And Auth Foundation - Research

**Researched:** 2026-04-28
**Domain:** Fastify service hardening, env validation, session contracts, API
error envelopes, and service observability foundations
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Prefer one shared session validation contract/helper over divergent
  per-service cookie/session reads.
- Preserve the existing HTTP-only cookie session model; do not introduce JWT
  auth in this phase.
- Follow the `packages/db/src/client.ts` pattern for Zod-validated env parsing
  at startup.
- Production must reject development markers and invalid secrets.
- Introduce a consistent service error envelope through Fastify error handlers.
- Keep `@pcp/shared` source-only and avoid adding new broad `any`/`z.any()`
  shortcuts.
- Pino logs should include `correlationId`, `userId`, and `service` where
  available, with redaction for secrets and PII.

### the agent's Discretion
- Exact helper/module location for shared session validation.
- Exact error envelope field names.
- Exact per-service split during planning.

### Deferred Ideas (OUT OF SCOPE)
- Full tenant-scoping audit belongs to Phase 2.
- Docker seccomp/AppArmor and runtime resource limits belong to Phase 3.
- Agent task durability, streaming, telemetry, and memory indexing belong to
  Phase 4.
- CI, metrics, traces, and frontend accessibility/i18n polish belong to
  Phase 5.
</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Session validation contract | API/Backend | Database | Services validate cookie sessions against DB-backed session state. |
| Env validation | API/Backend | Build/Deploy | Startup must fail before unsafe services accept traffic. |
| API error envelope | API/Backend | Frontend | Services own errors; frontend needs predictable response shape. |
| DTO contracts | Shared package | API/Backend, Frontend | Cross-boundary schemas belong in `@pcp/shared`. |
| Logging and health | API/Backend | Observability | Services own request context and operational signals. |
</architectural_responsibility_map>

<research_summary>
## Summary

This phase should establish small shared contracts before touching broader
security surfaces. The codebase already has the right building blocks:
Fastify v4, `fastify-type-provider-zod`, Zod, Pino, and a working DB env
validation pattern in `packages/db/src/client.ts`.

The standard approach is to fail fast at startup, centralize request/session
boundary behavior, and keep route handlers thin. Avoid a broad service rewrite:
create focused helpers and migrate representative services in a way that makes
later tenant-isolation and sandbox phases easier.

**Primary recommendation:** Build the shared session/env/error/logging
contracts first, then apply them service-by-service with tests that prove unsafe
config and unauthenticated access fail closed.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Fastify | 4.26.x | Service HTTP runtime | Existing service framework. |
| fastify-type-provider-zod | 1.1.x | Route schemas with Zod | Existing typed validation pattern. |
| Zod | 3.22.x | Env and DTO validation | Existing shared schema dependency. |
| Pino | 8.19.x | Structured logging | Existing Fastify logger. |
| Drizzle/Postgres | 0.45.x / 3.x | Session DB reads | Existing DB stack. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @fastify/cookie | 9.x | Session cookie extraction | Existing session-cookie model. |
| @fastify/rate-limit | 9.x | Request throttling | Already in services; preserve behavior. |
| Vitest | mixed 1.x/4.x | Regression tests | Do not unify versions casually. |
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Flow

1. Request enters Fastify service.
2. Shared request context/correlation handling attaches safe log fields.
3. Shared auth/session helper validates cookie/session and returns a typed user
   context or fails closed.
4. Route schema validates input and delegates to service logic.
5. Service throws typed/domain errors.
6. Fastify error handler maps errors to a consistent envelope.

### Pattern 1: Zod Env Parse At Startup
**What:** Define one schema per service env module and export parsed env.
**When to use:** Every service entry path.

### Pattern 2: Typed Auth Context
**What:** Convert cookie/session validation into a typed reusable boundary.
**When to use:** Every protected route and internal tool bridge.

### Pattern 3: Central Error Mapping
**What:** Translate internal errors into an API envelope in one Fastify handler.
**When to use:** Service entry setup before route registration.

### Anti-Patterns To Avoid
- Adding new `as any` casts to route responses to silence Fastify/Zod issues.
- Letting production boot with fallback secrets.
- Logging raw request bodies, provider keys, cookies, or decrypted secrets.
- Replacing the auth model with JWTs inside this foundation phase.
</architecture_patterns>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Breaking Local Development While Hardening Production
**What goes wrong:** Strict env validation makes local service startup painful.
**How to avoid:** Keep explicit development defaults only under development
mode, and make production reject unsafe values.
**Warning signs:** Tests need real secrets or developers add dummy prod fallbacks.

### Pitfall 2: Error Envelope Drift
**What goes wrong:** Each service implements a slightly different error shape.
**How to avoid:** Create a small shared error type/mapper and test representative
routes.
**Warning signs:** Frontend branches on multiple error response shapes.

### Pitfall 3: Auth Helper Without Tenant Context
**What goes wrong:** Helper proves identity but downstream code still forgets
workspace/user scope.
**How to avoid:** Return typed user context now and leave explicit tenant query
audits for Phase 2.
**Warning signs:** Protected routes accept resource IDs without user context.
</common_pitfalls>

<sources>
## Sources

### Primary (HIGH confidence)
- `AGENTS.md` - Repo invariants and GSD workflow enforcement.
- `CLAUDE.md` - Critical invariants and gotchas.
- `.planning/codebase/CONCERNS.md` - Production-readiness gaps.
- `.planning/codebase/ARCHITECTURE.md` - Service layering and cross-cutting
  concerns.
- `.planning/codebase/CONVENTIONS.md` - Validation, errors, logging, and DTO
  conventions.
- `packages/db/src/client.ts` - Existing env validation pattern.

### Secondary (MEDIUM confidence)
- `docs/PROGRESS.md` - Current status and open work.
- `docs/PRODUCTION.md` - Production deployment and hardening checklist.
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Fastify, Zod, Pino, Drizzle-backed sessions.
- Patterns: shared session validation, env parsing, error envelope, logging.
- Pitfalls: unsafe production defaults, error drift, auth helper scope gaps.

**Confidence breakdown:**
- Standard stack: HIGH - based on installed package metadata and docs.
- Architecture: HIGH - based on existing service structure and codebase maps.
- Pitfalls: HIGH - directly from documented concerns.

**Research date:** 2026-04-28
**Valid until:** 2026-05-28
</metadata>

---

*Phase: 01-contracts-config-and-auth-foundation*
*Research completed: 2026-04-28*
*Ready for planning: yes*
