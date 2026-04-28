# Phase 1: Contracts, Config, And Auth Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 01-contracts-config-and-auth-foundation
**Areas discussed:** Session Validation Contract, Environment Validation, API
Errors And DTO Contracts, Logging Health And Shutdown

---

## Session Validation Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Shared session contract/helper | Extract one compatible validation path for all services. | yes |
| Keep per-service validation | Continue direct DB session reads in each service. | |
| Move to JWT auth | Replace current cookie sessions with JWTs. | |

**User's choice:** Auto-inferred from repo docs and GSD continuation request.
**Notes:** Existing docs repeatedly flag duplicated session validation as a
production risk. Current architecture uses HTTP-only cookie sessions, so the
safer phase-one move is centralization/compatibility rather than auth rewrite.

---

## Environment Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Zod startup validation | Follow `packages/db/src/client.ts` style validation. | yes |
| Keep raw env fallbacks | Preserve service defaults and fallback values. | |
| External config service | Introduce a new config subsystem. | |

**User's choice:** Auto-inferred from docs.
**Notes:** Production blockers specifically call out fallback dummy secrets and
uneven env validation. This phase should fail fast on unsafe production config.

---

## API Errors And DTO Contracts

| Option | Description | Selected |
|--------|-------------|----------|
| Consistent Fastify error envelope | Add shared response shape and handler. | yes |
| Route-by-route ad hoc errors | Continue returning mixed `{ error }` shapes. | |
| Broad route refactor first | Rewrite route layering before error contracts. | |

**User's choice:** Auto-inferred from docs.
**Notes:** Error envelope consistency is a blocker for frontend reliability and
later CI/smoke gates. Route cleanup should be focused, not a broad rewrite.

---

## Logging Health And Shutdown

| Option | Description | Selected |
|--------|-------------|----------|
| Normalize service observability basics | Correlation fields, redaction, health, shutdown. | yes |
| Leave observability to final phase | Defer all logging/health work to later. | |
| Add full metrics/tracing now | Pull Phase 5 work into Phase 1. | |

**User's choice:** Auto-inferred from roadmap.
**Notes:** Phase 1 should provide logging/health foundations; full metrics and
trace propagation remain Phase 5.

---

## the agent's Discretion

- Exact shared-session helper location.
- Exact error envelope field names.
- Exact per-service split during planning.

## Deferred Ideas

- Tenant scoping audit and tests - Phase 2.
- Docker sandbox hardening - Phase 3.
- Agent durability and streaming - Phase 4.
- CI, metrics, traces, frontend polish - Phase 5.
