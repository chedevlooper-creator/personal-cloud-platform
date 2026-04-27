# Roadmap: CloudMind OS Reset

**Created:** 2026-04-27
**Mode:** Brownfield stabilization and verification
**Source:** Fresh codebase map in `.planning/codebase/`

## Summary

This roadmap intentionally ignores the archived legacy plan and rebuilds the active GSD path from the current source code. The work is ordered to make the platform safe and verifiable before adding more surface area.

| #   | Phase                                  | Goal                                                                                  | Requirements                                     |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | Baseline Health And Runtime Config     | Establish reliable local build/test/migration/service startup and fail-closed config  | BASE-01, BASE-02, BASE-03, BASE-04               |
| 2   | Auth, Admin, Secrets, Tenant Isolation | Close identity, authorization, secrets, and cross-tenant access gaps                  | AUTH-01..04, TENANT-01..03                       |
| 3   | Workspace Files And Real Snapshots     | Verify workspace file behavior and replace mocked snapshots with real archive/restore | WORK-01..04                                      |
| 4   | Runtime And Terminal Hardening         | Make Docker runtime and browser terminal safe, scoped, observable, and approval-aware | RUN-01..04                                       |
| 5   | Agent, Automations, Memory, Providers  | Connect agent tools to real services and secure automation/memory/provider flows      | AGENT-01..03, AUTO-01..02, MEM-01..02, AI-01..02 |
| 6   | Hosting And Publish                    | Secure publish identity and verify Docker/Traefik hosted service lifecycle            | HOST-01..04                                      |
| 7   | Frontend Product Completion            | Align UI modules with real backend behavior and remove placeholder gaps               | WEB-01..04                                       |
| 8   | Test, Docs, And Release Readiness      | Add critical tests, E2E smoke, docs truthfulness, and artifact hygiene                | QUAL-01..04                                      |

## Phase Details

### Phase 1: Baseline Health And Runtime Config

**Goal:** Make the repo reproducible from a clean checkout and define startup rules that fail closed outside development.

**Requirements:** BASE-01, BASE-02, BASE-03, BASE-04

**Status:** Partially complete. BASE-01 and BASE-04 are complete; BASE-02 and BASE-03 are documented but blocked for verification in this session because the `docker` CLI is unavailable.

**Success criteria:**

- Per-package build/typecheck/test commands are documented and runnable.
- Compose infra starts and health checks pass.
- Drizzle migrations apply from an empty database.
- Services validate required env vars at startup and reject production defaults.

**Canonical refs:**

- `.planning/codebase/STACK.md`
- `.planning/codebase/TESTING.md`
- `package.json`
- `infra/docker/docker-compose.yml`
- `packages/db/drizzle.config.ts`

**UI hint:** no

### Phase 2: Auth, Admin, Secrets, Tenant Isolation

**Goal:** Make identity and tenant ownership trustworthy across services.

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, TENANT-01, TENANT-02, TENANT-03

**Status:** Partially complete. Admin policy, provider credential response safety, publish identity derivation, and automation owner filters are implemented and covered by local tests. AUTH-01, full error envelope consistency, full tenant verification, and broader cross-route tests remain open.

**Success criteria:**

- Admin routes deny access when admin policy is missing or unmet.
- Publish and automation routes stop trusting client-supplied `userId`.
- Tenant isolation tests fail before fixes and pass after fixes.
- Logs avoid email/token/plain-secret exposure.
- Cookie/session validation behavior is consistent across services.

**Canonical refs:**

- `.planning/codebase/CONCERNS.md`
- `services/auth/src/routes/admin.ts`
- `services/auth/src/routes/profile.ts`
- `services/agent/src/routes/automation.ts`
- `services/publish/src/routes.ts`

**UI hint:** no

### Phase 3: Workspace Files And Real Snapshots

**Goal:** Make file storage and snapshot behavior match the product promise.

**Requirements:** WORK-01, WORK-02, WORK-03, WORK-04

**Success criteria:**

- File CRUD and upload paths are owner-scoped and path-safe.
- Storage usage changes correctly on create/upload/replace/delete.
- Snapshot creation writes a real archive object.
- Restore creates a safety backup and restores content predictably.
- Workspace tests cover traversal, ownership, and snapshot edge cases.

**Canonical refs:**

- `services/workspace/src/service.ts`
- `services/workspace/src/routes.ts`
- `services/workspace/src/routes/snapshots.ts`
- `packages/db/src/schema/workspace_files.ts`
- `packages/db/src/schema/snapshots.ts`

**UI hint:** yes

### Phase 4: Runtime And Terminal Hardening

**Goal:** Make browser terminal and runtime execution safe enough for user workspaces.

**Requirements:** RUN-01, RUN-02, RUN-03, RUN-04

**Success criteria:**

- Runtime ownership checks are tested for all lifecycle routes.
- Docker containers enforce non-root user, resource limits, dropped capabilities, and network policy.
- Command execution uses risk policy, approval requirements, timeout, and output truncation.
- Terminal attach/reconnect/error states are verified from browser UI.

**Canonical refs:**

- `.cursor/rules/sandbox.mdc`
- `services/runtime/src/service.ts`
- `services/runtime/src/provider/docker.ts`
- `services/runtime/src/routes.ts`
- `apps/web/src/components/workspace/terminal.tsx`

**UI hint:** yes

### Phase 5: Agent, Automations, Memory, Providers

**Goal:** Make the AI operator real, scoped, auditable, and connected to workspace/runtime capabilities.

**Requirements:** AGENT-01, AGENT-02, AGENT-03, AUTO-01, AUTO-02, MEM-01, MEM-02, AI-01, AI-02

**Success criteria:**

- Agent tools call real workspace/runtime services or explicit internal APIs.
- High-risk tool calls require approval and honor reject/timeout.
- Automation CRUD/run/history is tenant-scoped and tested.
- Memory vector search works with pgvector migrations and provider failure handling.
- Provider credential selection uses the current user's encrypted credentials only.

**Canonical refs:**

- `services/agent/src/orchestrator.ts`
- `services/agent/src/tools/*.ts`
- `services/agent/src/routes/automation.ts`
- `services/memory/src/service.ts`
- `services/auth/src/routes/profile.ts`

**UI hint:** yes

### Phase 6: Hosting And Publish

**Goal:** Make local app publishing secure and operational through Docker and Traefik.

**Requirements:** HOST-01, HOST-02, HOST-03, HOST-04

**Success criteria:**

- Publish routes derive authenticated identity and reject spoofed identities.
- Hosted service lifecycle is scoped to owned workspaces.
- Docker network naming works with the Compose stack.
- Start/stop/restart/delete transitions update status and logs accurately.
- A local hosted app is reachable at its generated URL.

**Canonical refs:**

- `services/publish/src/routes.ts`
- `services/publish/src/service.ts`
- `packages/db/src/schema/hosted_services.ts`
- `infra/docker/docker-compose.yml`
- `apps/web/src/app/(main)/hosting/page.tsx`

**UI hint:** yes

### Phase 7: Frontend Product Completion

**Goal:** Ensure the web app shows real product behavior rather than misleading placeholders.

**Requirements:** WEB-01, WEB-02, WEB-03, WEB-04

**Success criteria:**

- Navigation exposes only implemented or clearly gated modules.
- Auth, dashboard, workspace, chat, terminal, automations, hosting, snapshots, settings, and admin screens reflect actual API states.
- Loading, empty, error, unauthorized, and permission-denied states are consistent.
- Desktop and mobile smoke checks pass in browser.

**Canonical refs:**

- `apps/web/src/app/(main)`
- `apps/web/src/components/app-shell`
- `apps/web/src/components/workspace`
- `apps/web/src/lib/api.ts`
- `.planning/codebase/STRUCTURE.md`

**UI hint:** yes

### Phase 8: Test, Docs, And Release Readiness

**Goal:** Make the repo honest, testable, and ready for a real milestone tag.

**Requirements:** QUAL-01, QUAL-02, QUAL-03, QUAL-04

**Success criteria:**

- Critical services have tenant/security tests.
- Web has core flow smoke/E2E coverage.
- README no longer claims unsupported behavior or stale architecture.
- Generated artifacts and build outputs are intentionally tracked or ignored.
- A final milestone audit shows every v1 requirement mapped and verified.

**Canonical refs:**

- `.planning/codebase/TESTING.md`
- `README.md`
- `.gitignore`
- package scripts

**UI hint:** no

## Execution Notes

- Start with `$gsd-discuss-phase 1` if you want to refine the baseline approach.
- Use `$gsd-plan-phase 1` when ready to create the first executable plan.
- Run UI design contracts before frontend-heavy phases: 3, 4, 5, 6, and 7.
- Run security review after phases 2, 4, 5, and 6.

---

_Roadmap updated: 2026-04-27 after Phase 1 local smoke execution_
