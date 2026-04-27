# Requirements: CloudMind OS

**Defined:** 2026-04-27
**Core Value:** A user can safely run and manage a persistent AI-assisted workspace in the browser without losing data, crossing tenant boundaries, or executing unapproved risky actions.

## v1 Requirements

### Baseline And Infrastructure

- [x] **BASE-01**: Repository build, lint, test, and per-package typecheck commands are documented and runnable.
- [ ] **BASE-02**: Docker Compose infrastructure starts cleanly with Postgres pgvector, Redis, MinIO, Traefik, and Mailhog. Verification blocked in this session because `docker` is not installed.
- [ ] **BASE-03**: Database migrations apply from a clean database and match Drizzle schema. Verification blocked in this session because `docker` is not installed.
- [x] **BASE-04**: Runtime config is validated at service startup with fail-closed production rules.

### Authentication And Authorization

- [ ] **AUTH-01**: Users can register, log in, refresh, and log out with secure HTTP-only session cookies.
- [x] **AUTH-02**: Admin endpoints are inaccessible unless an explicit admin policy is configured and satisfied.
- [x] **AUTH-03**: Provider API keys are encrypted at rest and never returned or logged in plaintext.
- [ ] **AUTH-04**: Auth and profile routes avoid PII logging and return consistent error shapes. PII logging was reduced for touched auth flows; consistent error envelopes remain open.

### Tenant Isolation

- [x] **TENANT-01**: Every service derives user identity from authenticated session or internal service auth, not client-supplied `userId`.
- [ ] **TENANT-02**: Workspace, runtime, agent, memory, publish, automation, snapshot, and settings queries are scoped by user ownership. Publish and automation gaps were fixed; full route-by-route verification remains open.
- [ ] **TENANT-03**: Automated tests cover cross-user access denial for all critical resource routes. Added admin/provider/publish/automation coverage; full critical route coverage remains open.

### Workspace Files And Snapshots

- [ ] **WORK-01**: Users can create, list, open, move, delete, and upload files within owned workspaces.
- [ ] **WORK-02**: Storage object keys are tenant-prefixed and path traversal is blocked for all file operations.
- [ ] **WORK-03**: Workspace storage usage is accurate for create, upload, delete, and replace flows.
- [ ] **WORK-04**: Snapshots create real archives and restore them with a safety backup.

### Runtime And Terminal

- [ ] **RUN-01**: Users can create, start, stop, delete, and inspect runtimes only for owned workspaces.
- [ ] **RUN-02**: Command execution has approval-aware policy, timeout, output limits, and audit logs.
- [ ] **RUN-03**: Runtime containers enforce non-root, resource limits, read-only rootfs where possible, network policy, and dropped capabilities.
- [ ] **RUN-04**: Browser terminal attaches reliably to runtime streams and handles reconnect/error states.

### Agent And Automations

- [ ] **AGENT-01**: Agent chat creates conversations and tasks scoped to the current user and workspace.
- [ ] **AGENT-02**: Agent tools operate on real workspace/runtime APIs instead of simulated responses.
- [ ] **AGENT-03**: High-risk tool calls require approval and cannot execute after rejection or timeout.
- [ ] **AUTO-01**: Users can create, update, delete, manually run, and view automations only for owned resources.
- [ ] **AUTO-02**: Scheduled automation jobs record accurate run status, task linkage, output, and failure details.

### Memory And AI Providers

- [ ] **MEM-01**: Users can add, search, update, and delete memory entries scoped to their account and workspace.
- [ ] **MEM-02**: pgvector search works against migrated schema and handles provider failures gracefully.
- [ ] **AI-01**: OpenAI, Anthropic, and Minimax provider selection is explicit, validated, and testable.
- [ ] **AI-02**: User-supplied provider credentials are used only for that user's requests.

### Hosting And Publish

- [ ] **HOST-01**: Users can create, update, list, start, stop, restart, and delete hosted services only for owned workspaces.
- [ ] **HOST-02**: Publish service derives identity from auth context and rejects spoofed `userId` input.
- [ ] **HOST-03**: Docker/Traefik launch works with Compose network names and produces reachable local URLs.
- [ ] **HOST-04**: Hosted service logs, status, crash counts, and health metadata are accurate.

### Frontend Experience

- [ ] **WEB-01**: Auth pages, app shell, dashboard, workspace, chat, terminal, automations, hosting, snapshots, settings, and admin pages match real backend behavior.
- [ ] **WEB-02**: Placeholder modules are either implemented, clearly gated, or removed from navigation.
- [ ] **WEB-03**: Frontend handles loading, empty, error, unauthorized, and permission-denied states consistently.
- [ ] **WEB-04**: Core flows pass browser smoke tests on desktop and mobile widths.

### Quality And Documentation

- [ ] **QUAL-01**: Critical services have unit/integration tests for success, failure, and tenant isolation paths.
- [ ] **QUAL-02**: Web has smoke or E2E tests for primary user journeys.
- [ ] **QUAL-03**: README and docs describe the actual architecture and do not reference stale `apps/api` or completed legacy plans.
- [ ] **QUAL-04**: Generated artifacts and build outputs are intentionally tracked or ignored.

## v2 Requirements

### Collaboration And Organizations

- **ORG-01**: Organizations, teams, roles, and resource sharing.
- **ORG-02**: Fine-grained RBAC beyond single-user ownership.

### Production Operations

- **OPS-01**: CI/CD workflows with lint, typecheck, tests, image builds, and deploy gates.
- **OPS-02**: Structured metrics, traces, dashboards, and alerting.
- **OPS-03**: Backup, disaster recovery, and migration rollback playbooks.

### Product Expansion

- **MARKET-01**: Public skill/plugin marketplace.
- **MOBILE-01**: Native mobile clients.
- **BILL-01**: Billing, quotas, subscriptions, and usage plans.

## Out of Scope

| Feature                            | Reason                                                            |
| ---------------------------------- | ----------------------------------------------------------------- |
| Mobile apps                        | Web core is not production-stable yet.                            |
| Billing                            | Security and workspace correctness are higher leverage right now. |
| Enterprise org model               | Current code is user-first; orgs would multiply auth complexity.  |
| Public marketplace                 | Internal skill model should stabilize first.                      |
| Multi-region production deployment | Local Compose and single-node behavior need to work first.        |

## Traceability

| Requirement | Phase   | Status                          |
| ----------- | ------- | ------------------------------- |
| BASE-01     | Phase 1 | Complete                        |
| BASE-02     | Phase 1 | Blocked: Docker CLI unavailable |
| BASE-03     | Phase 1 | Blocked: Docker CLI unavailable |
| BASE-04     | Phase 1 | Complete                        |
| AUTH-01     | Phase 2 | Pending                         |
| AUTH-02     | Phase 2 | Complete                        |
| AUTH-03     | Phase 2 | Complete                        |
| AUTH-04     | Phase 2 | Partial: error envelopes remain |
| TENANT-01   | Phase 2 | Complete                        |
| TENANT-02   | Phase 2 | Partial: full verification open |
| TENANT-03   | Phase 2 | Partial: broader route coverage |
| WORK-01     | Phase 3 | Pending                         |
| WORK-02     | Phase 3 | Pending                         |
| WORK-03     | Phase 3 | Pending                         |
| WORK-04     | Phase 3 | Pending                         |
| RUN-01      | Phase 4 | Pending                         |
| RUN-02      | Phase 4 | Pending                         |
| RUN-03      | Phase 4 | Pending                         |
| RUN-04      | Phase 4 | Pending                         |
| AGENT-01    | Phase 5 | Pending                         |
| AGENT-02    | Phase 5 | Pending                         |
| AGENT-03    | Phase 5 | Pending                         |
| AUTO-01     | Phase 5 | Pending                         |
| AUTO-02     | Phase 5 | Pending                         |
| MEM-01      | Phase 5 | Pending                         |
| MEM-02      | Phase 5 | Pending                         |
| AI-01       | Phase 5 | Pending                         |
| AI-02       | Phase 5 | Pending                         |
| HOST-01     | Phase 6 | Pending                         |
| HOST-02     | Phase 6 | Pending                         |
| HOST-03     | Phase 6 | Pending                         |
| HOST-04     | Phase 6 | Pending                         |
| WEB-01      | Phase 7 | Pending                         |
| WEB-02      | Phase 7 | Pending                         |
| WEB-03      | Phase 7 | Pending                         |
| WEB-04      | Phase 7 | Pending                         |
| QUAL-01     | Phase 8 | Pending                         |
| QUAL-02     | Phase 8 | Pending                         |
| QUAL-03     | Phase 8 | Pending                         |
| QUAL-04     | Phase 8 | Pending                         |

**Coverage:**

- v1 requirements: 40 total
- Mapped to phases: 40
- Unmapped: 0

---

_Requirements defined: 2026-04-27_
_Last updated: 2026-04-27 after Phase 2 security execution_
