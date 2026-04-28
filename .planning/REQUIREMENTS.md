# Requirements: CloudMind OS Production Readiness

**Defined:** 2026-04-28
**Core Value:** Users can safely run and automate useful work inside persistent
cloud workspaces without leaking tenant data, credentials, or host resources.

## v1 Requirements

### Security And Isolation

- [x] **SEC-01**: User session validation is centralized or contract-compatible
  across all services so auth behavior cannot drift per service.
- [ ] **SEC-02**: Every DB-backed resource read/write enforces `userId`,
  `organizationId`, or workspace ownership at the persistence boundary. Phase
  2 plan 02-01 added representative scoped DB mutation/read coverage for
  datasets, runtime lifecycle, publish lifecycle, and channel task polling.
- [ ] **SEC-03**: File storage keys, snapshot paths, runtime labels, and hosted
  app labels are tenant-prefixed and path traversal safe.
- [ ] **SEC-04**: Privileged actions are audit logged without leaking PII,
  secrets, or plaintext credentials.

### Config And API Contracts

- [x] **CONF-01**: Every service validates required environment variables at
  startup with Zod or equivalent schema validation.
- [x] **CONF-02**: Production startup refuses dummy or development secrets,
  including invalid `COOKIE_SECRET` and `ENCRYPTION_KEY` values.
- [ ] **API-01**: Services return a consistent API error envelope through a
  Fastify error handler without leaking internal stack details. Phase 1 added
  the shared envelope and publish-service vertical slice; full service rollout
  remains.
- [ ] **API-02**: Shared request/response contracts live in `@pcp/shared` and
  route schemas avoid new `any`, `as any`, or broad `z.any()` shortcuts. Phase
  1 added the shared error contract and avoided new shortcuts in touched files.

### Sandbox And Runtime

- [ ] **SBOX-01**: Runtime and publish containers enforce non-root execution,
  read-only rootfs, dropped capabilities, no-new-privileges, tmpfs `/tmp`, and
  CPU/RAM/pid/wall-clock limits.
- [ ] **SBOX-02**: Runtime and publish workloads use seccomp/AppArmor or an
  equivalent hardened profile plus an image allow-list for untrusted execution.
- [ ] **SBOX-03**: Terminal and `run_command` tool execution surfaces policy
  decisions, resource limits, and approval requirements before side effects.
- [ ] **SBOX-04**: Hosted-service environment variables remain encrypted at rest,
  masked in client responses, and decrypted only for container launch.

### Agent And Automation

- [ ] **AGT-01**: High-risk tools, including `run_command`, browser click, and
  browser fill, require approval with expiry and auditable outcomes.
- [ ] **AGT-02**: Agent tasks, task steps, and tool calls recover or fail safely
  after process restart without double-executing side effects.
- [ ] **AGT-03**: Chat and task progress can stream to the frontend through
  WebSocket or SSE instead of relying only on polling.
- [ ] **AGT-04**: Token usage, model choice, provider, latency, and cost metadata
  are persisted for agent runs.
- [ ] **MEM-01**: Memory search uses a pgvector production index and a documented
  retrieval/reranking strategy.

### Observability, Delivery, And Frontend

- [ ] **OBS-01**: Pino logs consistently include `correlationId`, `userId`, and
  `service` fields with redaction for secrets and PII. Phase 1 added the
  publish-service slice and removed workspace session-cookie logging; full
  service rollout remains.
- [ ] **OBS-02**: Services expose metrics and propagate traces across service and
  agent-loop boundaries.
- [ ] **CI-01**: CI runs `pnpm typecheck`, `pnpm lint`, `pnpm test`, and a smoke
  gate before merge.
- [ ] **TST-01**: Critical services have tests for tenant isolation, env
  validation, API errors, and sandbox policy; `apps/web` and `packages/shared`
  have baseline coverage. Phase 2 plan 02-01 added focused tenant isolation
  regression tests for DB/resource scoping.
- [ ] **FE-01**: Frontend chat, tool approval, and async mutation states are
  accessible, realtime-aware, and invalidated predictably.
- [ ] **FE-02**: The web UI has an accessibility and mixed TR/EN copy pass for
  focus handling, contrast, dialogs, and user-facing labels.

## v2 Requirements

### Runtime Isolation

- **VM-01**: Runtime provider can swap Docker for Firecracker, Kata, gVisor, or
  another stronger isolation layer without rewriting route contracts.

### Product Expansion

- **PROD-01**: New user-facing modules can be added after the safety and
  delivery gates for this milestone are stable.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full microVM migration | Important but larger than this hardening milestone; Docker remains MVP boundary. |
| Single API gateway rewrite | Current architecture intentionally uses independent Fastify services. |
| `@pcp/shared` build artifact | Source-only shared contracts are an explicit repo invariant. |
| Broad Vitest unification | Test versions differ by service and should be upgraded intentionally. |
| New major product modules | Production-readiness work has priority over scope expansion. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Complete |
| CONF-01 | Phase 1 | Complete |
| CONF-02 | Phase 1 | Complete |
| API-01 | Phase 1 | Partial |
| API-02 | Phase 1 | Partial |
| OBS-01 | Phase 1 | Partial |
| SEC-02 | Phase 2 | Partial |
| SEC-03 | Phase 2 | Pending |
| SEC-04 | Phase 2 | Pending |
| TST-01 | Phase 2 | Partial |
| SBOX-01 | Phase 3 | Pending |
| SBOX-02 | Phase 3 | Pending |
| SBOX-03 | Phase 3 | Pending |
| SBOX-04 | Phase 3 | Pending |
| AGT-01 | Phase 4 | Pending |
| AGT-02 | Phase 4 | Pending |
| AGT-03 | Phase 4 | Pending |
| AGT-04 | Phase 4 | Pending |
| MEM-01 | Phase 4 | Pending |
| OBS-02 | Phase 5 | Pending |
| CI-01 | Phase 5 | Pending |
| FE-01 | Phase 5 | Pending |
| FE-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-04-28*
*Last updated: 2026-04-29 after Phase 2 plan 02-01 execution*
