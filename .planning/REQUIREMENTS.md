# CloudMind OS — v1 Requirements

## Requirement Quality Standards

All requirements are:
- **Specific and testable** — "User can X" with observable outcome
- **User-centric** — describes user capability, not system action
- **Atomic** — one capability per requirement
- **Independent** — minimal dependencies on other requirements

## Traceability

| REQ-ID | Requirement | Phase | Status |
|--------|-------------|-------|--------|
| AUTH-01 | User can register with email/password | 1 | Validated |
| AUTH-02 | User can log in and stay logged in across sessions | 1 | Validated |
| AUTH-03 | User can log out from any page | 1 | Validated |
| AUTH-04 | User can connect OAuth providers (Google, GitHub) | 1 | Validated |
| AUTH-05 | Session validation works across all services | 4 | Active |
| WS-01 | User can create a workspace | 1 | Validated |
| WS-02 | User can upload files to workspace | 1 | Validated |
| WS-03 | User can browse workspace file tree | 1 | Validated |
| WS-04 | User can read and edit text files in workspace | 1 | Validated |
| AGENT-01 | User can send a chat message to AI agent | 2 | Validated |
| AGENT-02 | Agent can execute tool calls (read/write files, run commands) | 2 | Validated |
| AGENT-03 | Agent loop processes multiple tool calls in single response | 5 | Active |
| AGENT-04 | Destructive tools require user approval | 2 | Validated |
| AGENT-05 | Agent persists task history and steps | 2 | Validated |
| AGENT-06 | Agent streams live updates via SSE | 2 | Validated |
| AGENT-07 | Agent supports multiple LLM providers (OpenAI, Anthropic, MiniMax) | 2 | Validated |
| AGENT-08 | User can save their own API credentials (BYOK) encrypted | 2 | Validated |
| AGENT-09 | Agent can search and add to long-term memory | 3 | Validated |
| AGENT-10 | Agent can browse web pages and extract content | 3 | Validated |
| AGENT-11 | Agent can search the web | 3 | Validated |
| AGENT-12 | Agent can run shell commands in sandboxed runtime | 2 | Validated |
| AUTO-01 | User can create scheduled automations | 3 | Validated |
| AUTO-02 | Automation worker waits for task real completion | 5 | Active |
| AUTO-03 | Automations support cron expressions | 3 | Validated |
| AUTO-04 | Automations can trigger via inbound webhook | 3 | Validated |
| AUTO-05 | Automation runs send notifications on completion/failure | 3 | Validated |
| MEM-01 | Memory service stores vector embeddings (pgvector) | 3 | Validated |
| MEM-02 | User can search memory by semantic similarity | 3 | Validated |
| RUN-01 | Runtime service creates Docker containers per workspace | 2 | Validated |
| RUN-02 | Runtime sandbox prevents host escape | 6 | Active |
| RUN-03 | Runtime enforces resource limits (CPU, memory, network) | 6 | Active |
| PUB-01 | User can publish/host apps from workspace | 4 | Active |
| SNAP-01 | User can create workspace snapshots | 4 | Active |
| SNAP-02 | User can restore workspace from snapshot | 4 | Active |
| CHAN-01 | User can link Telegram account to agent | 3 | Validated |
| CHAN-02 | Agent can receive and reply to Telegram messages | 3 | Validated |
| PERSONA-01 | User can create and manage agent personas | 3 | Validated |
| SKILL-01 | User can create custom skills (SKILL.md) | 3 | Validated |
| SKILL-02 | User can install skills from community registry (skills.sh) | 3 | Validated |
| NOTIFY-01 | User receives in-app notifications | 3 | Validated |
| NOTIFY-02 | Notification bell shows unread count | 3 | Validated |
| ADMIN-01 | Admin can view all users | 4 | Active |
| ADMIN-02 | Admin can view system health | 4 | Active |
| SEC-01 | Every DB query filters by user_id or organization_id | 5 | Active |
| SEC-02 | Storage paths are tenant-prefixed | 5 | Active |
| SEC-03 | Cross-service auth uses validated tokens | 4 | Active |
| PERF-01 | Agent endpoints have per-user rate limiting | 5 | Active |
| PERF-02 | Token usage is tracked and limited per user | 5 | Active |

## v2 Requirements (Deferred)

- OAuth providers beyond Google/GitHub (Twitter, Discord, etc.)
- Real-time collaborative workspace editing
- GPU-backed local model inference
- Mobile PWA offline support
- Multi-region deployment
- Advanced RBAC with teams/organizations

## Out of Scope

- Mobile native apps — browser PWA is the target
- Multi-region deployment — single-region MVP
- GPU acceleration for local models — cloud API only
- Real-time collaborative editing — single-user workspace focus
- Public marketplace for skills — community registry only

---
*Last updated: 2026-04-30*
