# Requirements: CloudMind OS Production Hardening

**Defined:** 2026-04-27
**Core Value:** Users can safely run and automate useful work inside persistent cloud workspaces without leaking tenant data, credentials, or host resources.

## v1 Requirements

Requirements for the current hardening milestone. Each maps to exactly one roadmap phase.

### Configuration

- [ ] **CONF-01**: Operator cannot start a production service when required secrets are missing, dummy, or development defaults.
- [ ] **CONF-02**: Operator can see a documented, validated env contract for each service and local infrastructure dependency.
- [ ] **CONF-03**: Service startup validates required env vars with typed schemas and fails with actionable errors.
- [ ] **CONF-04**: Development fallback values are limited to explicit local-development mode and cannot silently run in production.

### Auth and Tenant Security

- [ ] **AUTH-01**: User auth failures return generic messages while logs preserve enough non-PII context for diagnosis.
- [ ] **AUTH-02**: User sessions follow the security policy for cookie flags, expiration, refresh behavior, and invalidation.
- [ ] **AUTH-03**: Google OAuth uses state/PKCE protections and validates callback/redirect behavior against an allowlist.
- [ ] **TEN-01**: User cannot read, update, delete, execute, or host resources owned by another user.
- [ ] **TEN-02**: Workspace file/object storage keys are tenant/workspace-prefixed and path traversal-safe.
- [ ] **TEN-03**: Tenant isolation tests cover auth, workspace, runtime, agent, memory, publish, settings, and snapshots.

### API and Service Quality

- [ ] **API-01**: API routes return a consistent typed success/error shape that frontend clients can handle predictably.
- [ ] **API-02**: Service errors use typed domain errors at service boundaries instead of leaking raw implementation details.
- [ ] **API-03**: DB access touched during the milestone is tenant-scoped and organized behind repository/helper boundaries where it reduces risk.
- [ ] **API-04**: Structured service logs include service and request/user context without logging secrets or full PII.
- [ ] **API-05**: Root verification commands accurately check the intended packages, including explicit typecheck commands where root scripts are partial.

### Runtime Sandbox

- [ ] **SAND-01**: Runtime containers run with non-root user, read-only root filesystem where possible, restricted writable mounts, and dropped capabilities.
- [ ] **SAND-02**: Runtime execution enforces CPU, memory, pids, disk/tmpfs, timeout, and output-size limits.
- [ ] **SAND-03**: Runtime network behavior is explicit, tested, and defaults to no unapproved egress.
- [ ] **SAND-04**: Command filtering and terminal execution share one server-enforced policy rather than relying on frontend-only checks.
- [ ] **SAND-05**: Runtime logs and events capture command execution outcomes without leaking sensitive command payloads beyond intended audit fields.

### Agent Execution

- [ ] **AGNT-01**: Agent tools declare risk, input schema, timeout, idempotency, and required scopes in a typed registry.
- [ ] **AGNT-02**: High-risk tool calls pause execution until approval is recorded and cannot execute through bypass paths.
- [ ] **AGNT-03**: Agent tasks support durable cancellation, failure status, retry-safe persistence, and observable task-step history.
- [ ] **AGNT-04**: LLM provider calls have validated configuration, timeout/retry behavior, and no dummy-key production fallback.
- [ ] **AGNT-05**: Automations reflect actual task completion/failure rather than marking queued agent work complete prematurely.

### Frontend Integration

- [ ] **WEB-01**: Frontend REST and WebSocket clients use one documented dev/production routing strategy.
- [ ] **WEB-02**: Terminal UI connects to the runtime terminal endpoint reliably in local development and production proxy setups.
- [ ] **WEB-03**: User-facing flows expose loading, error, empty, and unauthorized states for critical workspace, agent, terminal, and settings actions.
- [ ] **WEB-04**: Frontend API types align with shared DTOs or generated typed client contracts for touched flows.

### Delivery and Operations

- [ ] **OPS-01**: Local `pnpm infra:up`, migrations, seed, service startup, and web startup have an up-to-date documented path.
- [ ] **OPS-02**: Production deployment docs match the actual service topology and remove stale gateway references.
- [ ] **OPS-03**: Docker/CI assets can build and verify web plus all services using deterministic commands.
- [ ] **OPS-04**: Health/readiness checks exist for each service and cover critical dependencies where appropriate.
- [ ] **OPS-05**: Build artifacts and generated files have an intentional git policy.

### Testing

- [ ] **TEST-01**: Auth/session/OAuth security behavior has focused automated tests.
- [ ] **TEST-02**: Tenant isolation has cross-user negative tests for every service that reads or mutates user data.
- [ ] **TEST-03**: Runtime sandbox restrictions have unit or integration tests for dangerous commands, limits, and network defaults.
- [ ] **TEST-04**: Agent approval and cancellation behavior has automated tests.
- [ ] **TEST-05**: At least one E2E smoke path covers login, workspace access, file operation, agent task creation, and terminal/hosting availability where feasible.

## v2 Requirements

Deferred to future releases. Tracked but not in the current roadmap.

### Runtime

- **RUNTIME-01**: Runtime execution can move from Docker to Firecracker or another microVM provider.
- **RUNTIME-02**: Runtime scheduling supports multiple execution hosts and placement decisions.

### Product

- **ORG-01**: Organizations, memberships, roles, and organization-scoped tenancy are supported.
- **BILL-01**: Billing, plans, quotas, and subscription enforcement are supported.
- **MOBILE-01**: A dedicated mobile app is available for core workflows.

### Platform

- **HOST-01**: Hosted apps can run across a multi-host orchestration layer rather than a single Docker socket.
- **OBS-01**: Metrics, traces, dashboards, and alerting are integrated with production observability tooling.

## Out of Scope

Explicitly excluded from this hardening milestone.

| Feature | Reason |
|---------|--------|
| `apps/api` gateway | The repo intentionally uses independent services; creating a gateway would conflict with current architecture. |
| Organization tenancy | Current implementation is user/workspace scoped; org support needs a separate product/data-model milestone. |
| Billing/payments | Not needed to make existing workspace/agent/runtime flows safe and reliable. |
| MicroVM runtime | Docker hardening is the immediate risk-reduction step; provider replacement is v2. |
| Multi-host app hosting | Current publish service is single-host Docker/Traefik; clustering is a later platform milestone. |
| Full visual redesign | The milestone is production hardening, not a UI rebrand. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONF-01 | Phase 1 | Pending |
| CONF-02 | Phase 1 | Pending |
| CONF-03 | Phase 1 | Pending |
| CONF-04 | Phase 1 | Pending |
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| TEN-01 | Phase 2 | Pending |
| TEN-02 | Phase 2 | Pending |
| TEN-03 | Phase 2 | Pending |
| API-01 | Phase 4 | Pending |
| API-02 | Phase 4 | Pending |
| API-03 | Phase 4 | Pending |
| API-04 | Phase 4 | Pending |
| API-05 | Phase 1 | Pending |
| SAND-01 | Phase 3 | Pending |
| SAND-02 | Phase 3 | Pending |
| SAND-03 | Phase 3 | Pending |
| SAND-04 | Phase 3 | Pending |
| SAND-05 | Phase 3 | Pending |
| AGNT-01 | Phase 3 | Pending |
| AGNT-02 | Phase 3 | Pending |
| AGNT-03 | Phase 3 | Pending |
| AGNT-04 | Phase 3 | Pending |
| AGNT-05 | Phase 3 | Pending |
| WEB-01 | Phase 4 | Pending |
| WEB-02 | Phase 4 | Pending |
| WEB-03 | Phase 4 | Pending |
| WEB-04 | Phase 4 | Pending |
| OPS-01 | Phase 1 | Pending |
| OPS-02 | Phase 5 | Pending |
| OPS-03 | Phase 5 | Pending |
| OPS-04 | Phase 5 | Pending |
| OPS-05 | Phase 1 | Pending |
| TEST-01 | Phase 5 | Pending |
| TEST-02 | Phase 5 | Pending |
| TEST-03 | Phase 5 | Pending |
| TEST-04 | Phase 5 | Pending |
| TEST-05 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 39 total
- Mapped to phases: 39
- Unmapped: 0

---
*Requirements defined: 2026-04-27*
*Last updated: 2026-04-27 after roadmap creation*
