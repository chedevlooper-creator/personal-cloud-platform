# REQUIREMENTS.md — CloudMind OS (v0.1 → Production-Readiness)

> Active production-readiness gaps. Sourced from `docs/superpowers/reports/2026-05-02-cloudmind-superpowers-gap-audit.md` P1 findings + graphify codebase scan.
>
> Validated capabilities (existing) live in `PROJECT.md` § Validated.

## v1 — Production-Readiness Hardening (current milestone)

### Security & Backend

- [x] **SEC-01** Typed domain errors mapped to HTTP envelopes (no plain `Error` → 500)
- [x] **SEC-02** Route catches don't leak driver/upstream details to clients
- [x] **SEC-03** Internal service token has audience/service scoping (no broad impersonation)
- [x] **SEC-04** Workspace routes use the central auth helper consistently
- [x] **SEC-05** Direct route DB work has a reviewed static inventory and cannot expand unnoticed
- [x] **SEC-06** Tenant isolation has DB-level backstop (RLS evaluation or audit tests)
- [x] **SEC-07** Redis-capable distributed rate limiting configured/covered for auth + agent
- [x] **SEC-08** Runtime/publish command policy tightened with sandbox regression tests

### Frontend & UX

- [x] **UX-01** Chat shell actions wired to provider state (no DOM custom-event toggle loops)
- [x] **UX-02** Settings panels are real API-backed forms with mobile layout
- [x] **UX-03** Automations: confirmation dialogs + real run history view (not placeholder)
- [x] **UX-04** Hosting: service detail / logs / env-var validation
- [x] **UX-05** Admin pages show explicit error states + responsive layouts
- [x] **UX-06** Files page usable on mobile / tablet
- [x] **UX-07** Custom controls audited/fixed for Phase 7 smoke and touch/keyboard basics

### Infrastructure & Docs

- [x] **INF-01** README rewritten to match current architecture (no stale `apps/api`)
- [x] **INF-02** Frontend smoke tests via Playwright (top-3 user flows)
- [x] **INF-03** `normalizeProfileValue` consolidated to `@pcp/shared` (deduplicate runtime/publish)

## v2 — Future (not in this milestone)

- Distributed tracing (OpenTelemetry)
- Multi-region failover
- BYOO (Bring Your Own Object Storage) beyond MinIO
- Public API + webhooks for third-party integrations
- Per-workspace resource quotas with billing surface

## Out of Scope

- Multi-region deployment — single-region sufficient at current scale
- SSO (SAML / Okta) — BYOK + email/password covers all personas
- Native mobile apps — responsive web only
- Kubernetes migration — Docker Compose handles current scale
- Vitest version unification — intentional split (auth/workspace v4, others v1)
- New product modules — finish hardening before adding surface area

## Traceability (Requirements → Phase)

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | 1 | Complete |
| SEC-02 | 1 | Complete |
| SEC-03 | 2 | Complete |
| SEC-04 | 2 | Complete |
| SEC-05 | 7 | Complete |
| SEC-06 | 5 | Complete |
| SEC-07 | 7 | Complete |
| SEC-08 | 6 | Complete |
| UX-01  | 7 | Complete |
| UX-02  | 3 | Complete |
| UX-03  | 4 | Complete |
| UX-04  | 4 | Complete |
| UX-05  | 7 | Complete |
| UX-06  | 7 | Complete |
| UX-07  | 7 | Complete |
| INF-01 | 7 | Complete |
| INF-02 | 7 | Complete |
| INF-03 | 7 | Complete |

---
*Last updated: 2026-05-08 after Phase 7 cleanup/docs/smoke/mobile/a11y hardening.*
