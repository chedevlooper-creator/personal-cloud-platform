# CloudMind OS — Roadmap

## Phase Overview

| # | Phase | Goal | Requirements | Status |
|---|-------|------|--------------|--------|
| 1 | Foundation | Auth, workspace, runtime MVP | AUTH-01..05, WS-01..04, RUN-01 | ✅ Complete |
| 2 | Agent Core | AI agent with tool calling | AGENT-01..02, AGENT-04..08, AGENT-12, RUN-01 | ✅ Complete |
| 3 | Agent Ecosystem | Memory, browser, automations, channels | AGENT-09..11, AUTO-01..05, MEM-01..02, CHAN-01..02, PERSONA-01, SKILL-01..02, NOTIFY-01..02 | ✅ Complete |
| 4 | Integration & Admin | Cross-service auth, publish, snapshots, admin | AUTH-05, PUB-01, SNAP-01..02, ADMIN-01..02, SEC-03 | ✅ Complete |
| 5 | Security & Reliability | Hardening, tenant isolation, rate limits | AGENT-03, AUTO-02, SEC-01..02, PERF-01..02 | ✅ Complete |
| 6 | Runtime Hardening | Sandbox security, resource limits | RUN-02..03 | ✅ Complete |

---

## Phase 1: Foundation ✅

**Goal:** Core platform with auth, workspace file management, and runtime creation.

**Requirements:** AUTH-01..05, WS-01..04, RUN-01

**Success Criteria:**
1. User can register, log in, and manage sessions
2. User can create workspace and upload files
3. Runtime service creates Docker containers on demand
4. All endpoints return proper HTTP status codes

**Deliverables:**
- `services/auth` — full auth service
- `services/workspace` — file CRUD + MinIO storage
- `services/runtime` — Docker container lifecycle
- `apps/web` — basic app shell + workspace UI

---

## Phase 2: Agent Core ✅

**Goal:** AI agent that can reason, call tools, and execute in workspace.

**Requirements:** AGENT-01..02, AGENT-04..08, AGENT-12, RUN-01

**Success Criteria:**
1. User can chat with agent and get responses
2. Agent can read/write workspace files
3. Agent can run shell commands (with approval)
4. Multiple LLM providers work (OpenAI, Anthropic, MiniMax)
5. BYOK credentials encrypt and decrypt correctly
6. Task lifecycle is observable via SSE

**Deliverables:**
- `services/agent` — orchestrator, LLM providers, tool registry
- 13 tools: read_file, write_file, list_files, run_command, web_search, web_fetch, browser_*, search_memory, add_memory, query_dataset
- `apps/web` — chat UI with SSE streaming

---

## Phase 3: Agent Ecosystem ✅

**Goal:** Memory, browser, automations, personas, skills, channels.

**Requirements:** AGENT-09..11, AUTO-01..05, MEM-01..02, CHAN-01..02, PERSONA-01, SKILL-01..02, NOTIFY-01..02

**Success Criteria:**
1. Agent recalls previous work via vector memory
2. Agent can browse web pages and extract data
3. Automations run on schedule and trigger via webhook
4. Telegram messages route to agent and receive replies
5. Personas and skills customize agent behavior
6. Notifications inform user of automation results

**Deliverables:**
- `services/memory` — vector embeddings + semantic search
- `services/browser` — headless browser automation
- `services/agent/automation` — BullMQ scheduler + worker
- `services/agent/channels` — Telegram webhook adapter
- `services/agent/personas` — persona CRUD
- `services/agent/skills` — skill CRUD + skills.sh registry
- `apps/web` — automations page, channels page, personas page, skills page

---

## Phase 4: Integration & Admin ✅

**Goal:** Cross-service auth consistency, publishing, snapshots, admin surfaces.

**Requirements:** AUTH-05, PUB-01, SNAP-01..02, ADMIN-01..02, SEC-03

**Plans:**
- **04-01** — Shared Auth Middleware (extract duplicated session validation)

**Success Criteria:**
1. Session validation is consistent across all 7 services ✅
2. User can publish workspace apps to public URL
3. User can create and restore workspace snapshots
4. Admin dashboard shows user list and system health

**Deliverables:**
- Shared auth middleware / service token validation ✅
- `services/publish` — app hosting via Traefik
- Snapshot CRUD in workspace service
- Admin UI in `apps/web`

---

## Phase 5: Security & Reliability ✅

**Goal:** Production readiness — tenant isolation, rate limits, correct async behavior.

**Requirements:** AGENT-03, AUTO-02, SEC-01..02, PERF-01..02

**Plans:**
- **05-01** — Tenant Isolation Audit (fix missing user_id filters)
- **05-02** — Rate Limiting (per-user limits on agent endpoints)
- **05-03** — Token Usage Tracking (monthly quotas, usage dashboard)

**Success Criteria:**
1. Agent processes all tool calls in a single LLM response ✅
2. Automation worker accurately reports task success/failure ✅
3. Every DB query is tenant-scoped ✅
4. Per-user rate limits prevent abuse ✅
5. Token usage is tracked and limited ✅

**Deliverables:**
- Multi-tool execution loop refactor ✅ (already done)
- Automation polling + timeout handling ✅ (already done)
- Tenant scoping audit across all services ✅
- Rate limiting middleware (per user) ✅
- Token quota tracking ✅

---

## Phase 6: Runtime Hardening ✅

**Goal:** Untrusted code execution without host escape.

**Requirements:** RUN-02..03

**Plans:**
- **06-01** — Runtime Hardening (seccomp, image whitelist, audit logging)
- **06-02** — Runtime Health Checks (periodic container security inspection)

**Success Criteria:**
1. Docker containers cannot access host filesystem ✅
2. Network is isolated or disabled by default ✅
3. CPU/memory limits are enforced ✅
4. Privilege escalation is blocked ✅
5. Security policy violations are auto-detected and remediated ✅

**Deliverables:**
- Seccomp profiles for runtime containers ✅
- cgroup resource limits ✅
- Network namespace isolation ✅
- Image whitelist / policy ✅
- Security audit logging ✅
- Periodic health check with auto-stop on violation ✅

---

## Requirement Traceability

| REQ-ID | Phase |
|--------|-------|
| AUTH-01..04 | 1 |
| AUTH-05 | 4 |
| WS-01..04 | 1 |
| AGENT-01..02, AGENT-04..08, AGENT-12 | 2 |
| AGENT-03 | 5 |
| AGENT-09..11 | 3 |
| AUTO-01, AUTO-03..05 | 3 |
| AUTO-02 | 5 |
| MEM-01..02 | 3 |
| RUN-01 | 1 |
| RUN-02..03 | 6 |
| PUB-01 | 4 |
| SNAP-01..02 | 4 |
| CHAN-01..02 | 3 |
| PERSONA-01 | 3 |
| SKILL-01..02 | 3 |
| NOTIFY-01..02 | 3 |
| ADMIN-01..02 | 4 |
| SEC-01..02 | 5 |
| SEC-03 | 4 |
| PERF-01..02 | 5 |

---
*Last updated: 2026-04-30*
