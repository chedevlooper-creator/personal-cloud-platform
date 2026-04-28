# Roadmap: CloudMind OS Production Readiness

## Overview

This roadmap turns the existing CloudMind OS brownfield codebase into a safer
production-ready platform. The milestone starts by tightening shared contracts,
startup config, auth, errors, and logs; then audits tenant boundaries; then
hardens runtime/publish sandboxes; then makes agent execution durable and
observable; and finally adds delivery gates, metrics, tracing, and frontend
polish.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work.
- Decimal phases (2.1, 2.2): Urgent insertions, marked with INSERTED.

- [x] **Phase 1: Contracts, Config, And Auth Foundation** - Make service startup,
  auth/session validation, API errors, DTOs, and logging safer and consistent.
  Completed as a foundation slice; API/OBS rollout follow-ups remain tracked in
  requirements.
- [ ] **Phase 2: Tenant Isolation And Audit Hardening** - Verify and enforce
  tenant scoping across data, storage, audit, and tests.
- [ ] **Phase 3: Runtime And Publish Sandbox Hardening** - Reduce host escape
  and resource-exhaustion risk for workspace and hosted-app containers.
- [ ] **Phase 4: Agent Durability, Approval, And Memory** - Make agent execution,
  approvals, streaming, telemetry, and memory retrieval production-ready.
- [ ] **Phase 5: Delivery, Observability, And Frontend Polish** - Add CI gates,
  metrics/traces, and frontend realtime/accessibility/i18n polish.

## Phase Details

### Phase 1: Contracts, Config, And Auth Foundation
**Goal**: Services fail fast on unsafe config and expose consistent auth,
error, DTO, logging, health, and shutdown behavior.
**Depends on**: Nothing (first phase)
**Requirements**: [SEC-01, CONF-01, CONF-02, API-01, API-02, OBS-01]
**Success Criteria** (what must be TRUE):
  1. Services reject missing or dummy production secrets at startup.
  2. Session validation behavior is shared or contract-compatible across services.
  3. API clients receive a consistent error envelope without internal stack leaks.
  4. Logs include required context fields and redact secrets/PII.
**Plans**: 3 plans

Plans:
**Wave 1**
- [x] 01-01: Centralize session/env validation patterns.

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02: Standardize API errors and shared DTO contracts.
- [x] 01-03: Normalize logging, health checks, and shutdown behavior.

Cross-cutting constraints:
- Preserve HTTP-only cookie sessions; no JWT auth rewrite in this phase.
- Production must reject missing, dummy, or development-marked secrets.
- Client-facing errors and logs must not leak internal details, secrets, or PII.

### Phase 2: Tenant Isolation And Audit Hardening
**Goal**: Data, storage, and audit behavior consistently prove tenant isolation
at the boundary where side effects happen.
**Depends on**: Phase 1
**Requirements**: [SEC-02, SEC-03, SEC-04, TST-01]
**Success Criteria** (what must be TRUE):
  1. Resource queries are scoped by user, organization, or workspace ownership.
  2. Storage paths, runtime labels, and hosted-app labels are tenant-prefixed.
  3. Privileged actions write audit rows without PII or plaintext secrets.
  4. Tests fail if representative tenant scoping checks are removed.
**Plans**: 3 plans

Plans:
- [ ] 02-01: Audit and enforce DB/resource scoping.
- [ ] 02-02: Harden storage paths, runtime labels, and audit coverage.
- [ ] 02-03: Add tenant isolation and contract regression tests.

### Phase 3: Runtime And Publish Sandbox Hardening
**Goal**: Workspace runtimes and hosted app containers run with stricter Docker
boundaries, resource limits, and tool policy visibility.
**Depends on**: Phase 2
**Requirements**: [SBOX-01, SBOX-02, SBOX-03, SBOX-04]
**Success Criteria** (what must be TRUE):
  1. Runtime and publish containers are non-root, read-only, capability-dropped,
     and resource-limited by default.
  2. Hardened seccomp/AppArmor or equivalent profiles and image allow-listing are
     wired into container launch paths.
  3. Terminal and `run_command` policy decisions expose limits and approval needs.
  4. Hosted-service env vars stay encrypted at rest and masked in API responses.
**Plans**: 3 plans

Plans:
- [ ] 03-01: Harden Docker provider defaults for runtime and publish.
- [ ] 03-02: Add execution policy, limits, and approval visibility.
- [ ] 03-03: Verify hosted-service secret handling and sandbox tests.

### Phase 4: Agent Durability, Approval, And Memory
**Goal**: Agent tasks can survive failure modes, gate high-risk tools, stream
progress, record cost telemetry, and use production-grade memory retrieval.
**Depends on**: Phase 3
**Requirements**: [AGT-01, AGT-02, AGT-03, AGT-04, MEM-01]
**Success Criteria** (what must be TRUE):
  1. High-risk tool calls require approval, expire predictably, and are audited.
  2. Process restart cannot silently lose or double-execute side-effectful tool
     calls.
  3. Chat and task progress stream to the web UI.
  4. Agent runs persist provider/model/token/latency/cost metadata.
  5. Memory search uses a documented pgvector index and retrieval strategy.
**Plans**: 3 plans

Plans:
- [ ] 04-01: Harden tool approval and task recovery semantics.
- [ ] 04-02: Add streaming and token/cost telemetry.
- [ ] 04-03: Add pgvector memory indexing and retrieval improvements.

### Phase 5: Delivery, Observability, And Frontend Polish
**Goal**: The platform has merge gates, operational visibility, and a frontend
that exposes realtime work safely and accessibly.
**Depends on**: Phase 4
**Requirements**: [OBS-02, CI-01, FE-01, FE-02]
**Success Criteria** (what must be TRUE):
  1. CI runs typecheck, lint, tests, and smoke checks before merge.
  2. Services expose metrics and propagate traces across request/agent paths.
  3. Frontend async states and tool approval flows handle streaming and failures.
  4. Focus, contrast, dialog behavior, and mixed TR/EN copy receive an
     accessibility and copy pass.
**Plans**: 2 plans

Plans:
- [ ] 05-01: Add CI, metrics, and trace propagation.
- [ ] 05-02: Polish frontend realtime, accessibility, and i18n surfaces.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Contracts, Config, And Auth Foundation | 3/3 | Complete | 2026-04-28 |
| 2. Tenant Isolation And Audit Hardening | 0/3 | Ready to execute | - |
| 3. Runtime And Publish Sandbox Hardening | 0/3 | Not started | - |
| 4. Agent Durability, Approval, And Memory | 0/3 | Not started | - |
| 5. Delivery, Observability, And Frontend Polish | 0/2 | Not started | - |

## Backlog

No deferred phase work yet.
