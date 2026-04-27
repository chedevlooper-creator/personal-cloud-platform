# Roadmap: CloudMind OS Production Hardening

## Overview

This roadmap hardens an existing broad MVP into a safer, more reliable platform. The phases are ordered by risk: first make configuration and verification trustworthy, then close auth/tenant isolation gaps, then harden runtime and agent execution, then align API/frontend contracts, and finally add deployment and regression coverage so future changes can ship with confidence.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Configuration & Verification Baseline** - Services fail closed in production and local verification commands are trustworthy.
- [ ] **Phase 2: Auth & Tenant Isolation** - Users cannot cross account/workspace boundaries and auth behavior matches the security policy.
- [ ] **Phase 3: Runtime & Agent Execution Safety** - Docker execution, terminal commands, tools, approvals, and automations are enforced server-side.
- [ ] **Phase 4: API & Frontend Contract Alignment** - Frontend clients, API responses, service errors, and realtime routing behave predictably.
- [ ] **Phase 5: Delivery & Regression Coverage** - Deployment docs/assets and automated tests cover the critical production paths.

## Phase Details

### Phase 1: Configuration & Verification Baseline
**Goal**: Operators can start and verify the platform without accidentally running production on dummy secrets or misleading root scripts.
**Depends on**: Nothing (first phase)
**Requirements**: [CONF-01, CONF-02, CONF-03, CONF-04, API-05, OPS-01, OPS-05]
**UI hint**: no
**Success Criteria** (what must be TRUE):
  1. Operator cannot boot production services with dummy cookies, encryption keys, or provider credentials.
  2. Operator can read one env contract and know which variables each service requires.
  3. Developer can run documented verification commands and trust which packages were actually checked.
  4. Build artifacts and generated files have an intentional tracked/ignored policy.
**Plans**: 3 plans

Plans:
- [ ] 01-01: Inventory env usage, remove unsafe production fallbacks, and add typed startup validation.
- [ ] 01-02: Correct root/package verification commands and document per-package checks.
- [ ] 01-03: Decide and apply git policy for build artifacts, generated files, and local-only state.

### Phase 2: Auth & Tenant Isolation
**Goal**: User identity, sessions, OAuth, database queries, and storage paths enforce account boundaries consistently.
**Depends on**: Phase 1
**Requirements**: [AUTH-01, AUTH-02, AUTH-03, TEN-01, TEN-02, TEN-03]
**UI hint**: no
**Success Criteria** (what must be TRUE):
  1. User auth failures are generic to clients and useful to operators without exposing full PII.
  2. User sessions and OAuth callbacks meet the documented cookie, state, PKCE, expiration, and redirect rules.
  3. User cannot access another user's workspaces, files, runtimes, agent tasks, memories, hosted services, settings, snapshots, or credentials.
  4. Storage keys and file paths remain tenant/workspace-scoped under traversal attempts.
**Plans**: 3 plans

Plans:
- [ ] 02-01: Harden auth/session/OAuth behavior and tests.
- [ ] 02-02: Audit and fix tenant scoping across service DB/storage operations.
- [ ] 02-03: Add cross-user negative tests for tenant isolation and path safety.

### Phase 3: Runtime & Agent Execution Safety
**Goal**: Users can execute terminal and agent work only through server-enforced policies with durable approvals, limits, and audit records.
**Depends on**: Phase 2
**Requirements**: [SAND-01, SAND-02, SAND-03, SAND-04, SAND-05, AGNT-01, AGNT-02, AGNT-03, AGNT-04, AGNT-05]
**UI hint**: no
**Success Criteria** (what must be TRUE):
  1. Runtime containers are constrained by user, filesystem, capability, network, CPU, memory, pids, disk/tmpfs, timeout, and output limits.
  2. Terminal and command execution share one server-side policy and dangerous commands are blocked even if the browser is bypassed.
  3. High-risk agent tool calls cannot execute until approval is recorded and visible in task history.
  4. Agent tasks, provider failures, cancellations, and automations end in accurate durable states.
  5. Runtime and agent logs preserve audit value without exposing secrets.
**Plans**: 3 plans

Plans:
- [ ] 03-01: Harden Docker runtime provider options, command policy, and runtime audit behavior.
- [ ] 03-02: Make agent tool metadata, approval enforcement, cancellation, and provider configuration durable.
- [ ] 03-03: Correct automation completion semantics and add runtime/agent safety tests.

### Phase 4: API & Frontend Contract Alignment
**Goal**: Frontend and services share predictable contracts for REST, WebSocket, errors, and critical workflow states.
**Depends on**: Phase 3
**Requirements**: [API-01, API-02, API-03, API-04, WEB-01, WEB-02, WEB-03, WEB-04]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. Frontend clients receive consistent success/error responses and can display loading, empty, unauthorized, and failure states for critical flows.
  2. Terminal WebSocket connects reliably in local development and production proxy setups.
  3. Touched service boundaries use typed domain errors and structured logs with service/request/user context.
  4. Touched frontend API types align with shared DTOs or an explicit typed-client contract.
**Plans**: 3 plans

Plans:
- [ ] 04-01: Standardize API response/error handling for touched service routes and frontend clients.
- [ ] 04-02: Fix REST/WebSocket routing strategy and terminal connection behavior.
- [ ] 04-03: Fill critical UI states and align touched client types with shared contracts.

### Phase 5: Delivery & Regression Coverage
**Goal**: The platform has deployment assets, documentation, health checks, and regression tests that protect the hardened paths.
**Depends on**: Phase 4
**Requirements**: [OPS-02, OPS-03, OPS-04, TEST-01, TEST-02, TEST-03, TEST-04, TEST-05]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. Operator can follow current docs to build, migrate, start, and health-check the real service topology.
  2. CI or documented local commands build and verify web plus all services deterministically.
  3. Automated tests cover auth/session/OAuth security, tenant isolation, runtime restrictions, agent approvals/cancellation, and one critical E2E smoke flow where feasible.
  4. Production docs no longer reference stale gateway architecture or incorrect secret-generation guidance.
**Plans**: 3 plans

Plans:
- [ ] 05-01: Update deployment docs, Docker/CI assets, and health/readiness checks.
- [ ] 05-02: Add targeted automated tests for auth, tenant isolation, runtime, and agent behavior.
- [ ] 05-03: Add an E2E smoke path or documented feasible substitute for the critical user journey.

## Coverage Validation

Every v1 requirement in `.planning/REQUIREMENTS.md` maps to exactly one phase.

| Phase | Requirements | Count |
|-------|--------------|-------|
| Phase 1 | CONF-01, CONF-02, CONF-03, CONF-04, API-05, OPS-01, OPS-05 | 7 |
| Phase 2 | AUTH-01, AUTH-02, AUTH-03, TEN-01, TEN-02, TEN-03 | 6 |
| Phase 3 | SAND-01, SAND-02, SAND-03, SAND-04, SAND-05, AGNT-01, AGNT-02, AGNT-03, AGNT-04, AGNT-05 | 10 |
| Phase 4 | API-01, API-02, API-03, API-04, WEB-01, WEB-02, WEB-03, WEB-04 | 8 |
| Phase 5 | OPS-02, OPS-03, OPS-04, TEST-01, TEST-02, TEST-03, TEST-04, TEST-05 | 8 |

**Coverage:** 39/39 v1 requirements mapped, 0 unmapped.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Configuration & Verification Baseline | 0/3 | Not started | - |
| 2. Auth & Tenant Isolation | 0/3 | Not started | - |
| 3. Runtime & Agent Execution Safety | 0/3 | Not started | - |
| 4. API & Frontend Contract Alignment | 0/3 | Not started | - |
| 5. Delivery & Regression Coverage | 0/3 | Not started | - |
