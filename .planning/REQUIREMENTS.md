# REQUIREMENTS.md — CloudMind OS (v0.1 → Production-Readiness)

> Active production-readiness gaps. Sourced from `docs/superpowers/reports/2026-05-02-cloudmind-superpowers-gap-audit.md` P1 findings + graphify codebase scan.
>
> Validated capabilities (existing) live in `PROJECT.md` § Validated.

## v1 — Production-Readiness Hardening (current milestone)

### Security & Backend

- [ ] **SEC-01** Typed domain errors mapped to HTTP envelopes (no plain `Error` → 500)
- [ ] **SEC-02** Route catches don't leak driver/upstream details to clients
- [ ] **SEC-03** Internal service token has audience/service scoping (no broad impersonation)
- [ ] **SEC-04** Workspace routes use the central auth helper consistently
- [ ] **SEC-05** Routes never do direct DB work — repository layer enforced
- [ ] **SEC-06** Tenant isolation has DB-level backstop (RLS evaluation or audit tests)
- [ ] **SEC-07** Distributed rate limiting that survives horizontal scale
- [ ] **SEC-08** Runtime/publish command policy tightened with sandbox regression tests

### Frontend & UX

- [ ] **UX-01** Chat shell actions wired to provider state (no DOM custom-event toggle loops)
- [ ] **UX-02** Settings panels are real API-backed forms with mobile layout
- [ ] **UX-03** Automations: confirmation dialogs + real run history view (not placeholder)
- [ ] **UX-04** Hosting: service detail / logs / env-var validation
- [ ] **UX-05** Admin pages show explicit error states + responsive layouts
- [ ] **UX-06** Files page usable on mobile / tablet
- [ ] **UX-07** All custom controls accessible (keyboard + touch + ARIA)

### Infrastructure & Docs

- [ ] **INF-01** README rewritten to match current architecture (no stale `apps/api`)
- [ ] **INF-02** Frontend smoke tests via Playwright (top-3 user flows)
- [ ] **INF-03** `normalizeProfileValue` consolidated to `@pcp/shared` (deduplicate runtime/publish)

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
| SEC-01 | 1 | Pending |
| SEC-02 | 1 | Pending |
| SEC-03 | 2 | Pending |
| SEC-04 | 2 | Pending |
| SEC-05 | 7 | Pending |
| SEC-06 | 5 | Pending |
| SEC-07 | 7 | Pending |
| SEC-08 | 6 | Pending |
| UX-01  | 7 | Pending |
| UX-02  | 3 | Pending |
| UX-03  | 4 | Pending |
| UX-04  | 4 | Pending |
| UX-05  | 7 | Pending |
| UX-06  | 7 | Pending |
| UX-07  | 7 | Pending |
| INF-01 | 7 | Pending |
| INF-02 | 7 | Pending |
| INF-03 | 7 | Pending |

---
*Last updated: 2026-05-06 (initial brownfield extraction).*
