# Codebase Concerns

**Analysis Date:** 2026-04-27

## Tech Debt

**GSD/project planning state was deleted locally before this run:**
- Issue: Git status showed tracked `.planning/*` files deleted before this initialization recreated local planning artifacts.
- Impact: Prior roadmap/phase context may have existed and may not fully match this regenerated brownfield plan.
- Fix approach: Compare against git history before deleting or replacing any planning artifacts that still matter.

**README and repo instructions disagree about backend shape:**
- Issue: README references stale ideas such as an API gateway in parts of older docs, while `AGENTS.md` states there is no `apps/api`.
- Impact: New contributors or agents may target a non-existent gateway.
- Fix approach: Treat `AGENTS.md`, actual package manifests, and source tree as authoritative; update README/docs if needed.

**Service layering is incomplete:**
- Issue: Repo rules prescribe repository -> service -> route layering, but services generally call Drizzle directly from service classes.
- Files: `services/auth/src/service.ts`, `services/workspace/src/service.ts`, `services/runtime/src/service.ts`, `services/agent/src/orchestrator.ts`.
- Impact: Tenant scoping, transactions, and testability are harder to audit consistently.
- Fix approach: Introduce repositories only when touching a domain enough to justify the migration; do not refactor all services blindly.

**Fallback secrets and dummy provider keys exist in runtime code:**
- Issue: Several services use insecure fallback secrets or dummy API keys.
- Files: `services/auth/src/index.ts`, `services/workspace/src/index.ts`, `services/runtime/src/index.ts`, `services/agent/src/llm/provider.ts`, `services/memory/src/service.ts`, `services/auth/src/encryption.ts`.
- Impact: Production misconfiguration can silently start with unsafe values.
- Fix approach: Validate required env vars with Zod at startup and fail closed outside local development.

**Type safety debt from `any` and casts:**
- Issue: Many route replies and provider boundaries use `as any`, `z.any()`, or `logger: any`.
- Files: `services/workspace/src/routes.ts`, `services/runtime/src/routes.ts`, `services/agent/src/orchestrator.ts`, `services/publish/src/service.ts`, `packages/shared/src/agent.ts`.
- Impact: Strict TypeScript guarantees are weakened around API and provider boundaries.
- Fix approach: Narrow unknowns at boundaries and add typed error/response helpers.

## Known Bugs

**Frontend terminal WebSocket URL likely mismatches runtime service route:**
- Symptoms: `useTerminal` connects to the current web host at `/api/runtimes/:id/terminal`.
- Files: `apps/web/src/hooks/use-terminal.ts`, `services/runtime/src/routes.ts`.
- Trigger: Running web on `localhost:3000` without a proxy from `/api/runtimes` to runtime service.
- Workaround: Use a configured reverse proxy or change client URL construction.
- Root cause: Direct service URLs are used for REST clients, but WebSocket path assumes same-origin proxy.

**Production guide encryption-key example is internally inconsistent:**
- Symptoms: `openssl rand -hex 16` is described as producing 32 hex chars but not 32 bytes.
- File: `docs/PRODUCTION.md`.
- Impact: Operators may generate a key with incorrect byte length.
- Fix approach: Replace with a single correct command and document expected encoding.

**Build artifacts are present despite ignore rules:**
- Symptoms: `dist/` and `*.tsbuildinfo` files exist under services/packages while root `.gitignore` ignores those paths.
- Impact: Git state and build reproducibility may be confusing.
- Fix approach: Decide whether build outputs are tracked; clean or unignore intentionally.

## Security Considerations

**Tenant isolation needs systematic audit:**
- Risk: Rules require every query to scope by `user_id` or `organization_id`.
- Current mitigation: Many service methods include `userId` filters.
- Gaps: Some updates/deletes filter by resource ID only after prior lookup; raw SQL in memory service must be checked carefully.
- Recommendations: Add tenant isolation tests per service and prefer repository helpers that require tenant context.

**Auth/OAuth hardening is incomplete relative to rules:**
- Risk: OAuth flow currently uses `@fastify/oauth2`, but explicit PKCE/state verification details are not visible in app code.
- Current mitigation: Cookie sessions, Argon2 password hashing, rate limiting on auth routes.
- Recommendations: Verify OAuth state/PKCE behavior, enforce allowlisted redirect URIs, remove dummy credentials, and shorten/refresh sessions per security policy.

**Runtime sandbox is MVP-level:**
- Risk: Docker containers have `NetworkMode: none`, but read-only rootfs, non-root user, capabilities, pids, seccomp/apparmor, and disk/tmpfs limits are not evident.
- Current mitigation: No network by default, memory/CPU options, command deny patterns, 60-second exec timeout.
- Recommendations: Implement the sandbox rules in `.cursor/rules/sandbox.mdc` before treating runtime execution as production-safe.

**Command approval flow is only partially enforced:**
- Risk: Agent tool calls include approval records, but `RunCommandTool` currently simulates execution and orchestrator comments mention hardcoded approval handling.
- Current mitigation: `run_command` requires approval in the tool class and task routes include approval submission.
- Recommendations: Make approval state durable and enforced before real runtime command execution is wired.

**Secrets may be read from multiple env file locations:**
- Risk: `services/agent/src/env.ts` walks env files and applies first-missing variables.
- Current mitigation: `.env` patterns are ignored.
- Recommendations: Document precedence and avoid service-local secrets drifting from root infra secrets.

## Performance Bottlenecks

**Agent loop is synchronous per task and polls DB-like state:**
- Problem: `AgentOrchestrator` starts an async loop and persists steps, but execution model is not yet worker-isolated.
- Cause: MVP implementation prioritizes simplicity.
- Improvement path: Move long-running agent loops to durable queue workers with cancellation, retry, token/cost budgets, and streaming events.

**Memory search computes embeddings per query and uses raw vector SQL:**
- Problem: Every search calls the embedding provider and queries pgvector.
- Cause: Direct implementation in `services/memory/src/service.ts`.
- Improvement path: Add provider retries/timeouts, HNSW indexes, result limits, and tests for tenant filters.

**Workspace listing and file metadata may grow without cursor pagination:**
- Problem: Existing shared schemas use page/limit or simple path queries.
- Cause: MVP CRUD design.
- Improvement path: Add cursor pagination for large directories and enforce query limits.

## Fragile Areas

**Database schema ownership:**
- Why fragile: Every service imports the shared DB client directly.
- Common failures: Cross-service schema coupling, accidental unscoped queries, migration conflicts.
- Safe modification: Read `.cursor/rules/database.mdc`, add migrations through `packages/db`, and test affected services.

**Runtime and publish Docker interactions:**
- Why fragile: Docker socket access is powerful and environment-specific.
- Common failures: container cleanup leaks, network mismatch, Traefik label mistakes, host path assumptions under `/tmp/workspaces`.
- Safe modification: Add tests/mocks around Dockerode and verify with local Docker Compose.

**Frontend service URLs:**
- Why fragile: REST clients use env-configured service URLs, while some flows assume same-origin routes.
- Common failures: CORS failures, cookie scope problems, WebSocket connection failures.
- Safe modification: Define one routing strategy for dev and production.

## Scaling Limits

**Single Postgres for relational and vector workloads:**
- Current capacity: Appropriate for MVP/small deployments.
- Limit: Heavy vector search or high-volume task logging may contend with transactional workloads.
- Scaling path: Add indexes, partition high-volume logs, introduce read replicas, or split vector storage later.

**Runtime service statefulness:**
- Current capacity: Single Docker host assumptions.
- Limit: Horizontal scaling requires runtime placement, sticky terminal sessions, and workspace volume strategy.
- Scaling path: Add scheduler/placement layer and persistent shared workspace storage.

**Publish service local container model:**
- Current capacity: Local Traefik plus Docker network.
- Limit: Multi-host hosting requires orchestration beyond Dockerode on one socket.
- Scaling path: Kubernetes/Nomad/Fly-style deploy backend or a purpose-built runner pool.

## Dependencies at Risk

**Fastify v4 with mixed plugin versions:**
- Risk: Upgrades to Fastify v5 would require plugin compatibility review.
- Impact: All services.
- Migration plan: Upgrade one service first with route/schema tests.

**Next.js 16 / React 19:**
- Risk: Breaking changes versus older examples.
- Impact: Frontend routing, server/client boundaries, config.
- Migration plan: Follow `apps/web/AGENTS.md` and read local Next docs before routing/config changes.

**Dockerode versions differ:**
- Risk: `services/runtime` uses Dockerode 4.x while `services/publish` uses 3.x.
- Impact: Provider API behavior and types can diverge.
- Migration plan: Unify only after tests cover both runtime and publish behavior.

## Missing Critical Features

**End-to-end integration tests:**
- Problem: User journeys span web, auth, workspace, runtime, agent, storage, and DB.
- Current workaround: Unit tests and manual local startup.
- Blocks: Confident production hardening.
- Implementation complexity: Medium/high.

**Operational readiness:**
- Problem: Production guide exists, but Dockerfiles, CI, migrations in deploy flow, metrics, and security scans are not fully evident.
- Current workaround: Local Docker Compose and manual commands.
- Blocks: Reliable deployment.
- Implementation complexity: Medium.

**Consistent API envelope and error taxonomy:**
- Problem: Repo rules ask for `{ data, error, meta }`, but current routes return mixed shapes.
- Current workaround: frontend `getApiErrorMessage`.
- Blocks: Predictable client handling.
- Implementation complexity: Medium.

## Test Coverage Gaps

**Frontend:**
- What's not tested: pages, app shell, terminal, file manager, agent chat, settings/admin.
- Risk: UI regressions and API contract drift.
- Priority: High for user-facing work.

**Runtime security:**
- What's not tested: command filter bypasses, timeouts, Docker HostConfig restrictions, terminal attach.
- Risk: unsafe command execution.
- Priority: High.

**Tenant isolation:**
- What's not tested: cross-user access attempts across services.
- Risk: data leakage.
- Priority: Critical.

---
*Concerns audit: 2026-04-27*
*Update as issues are fixed or new ones discovered*
