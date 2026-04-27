---
focus: arch
mapped_at: 2026-04-27
last_mapped_commit: c55e9b3bb8f13d990887889dfeb3418507c7a360
---

# Architecture

## System Shape

The repository is a multi-service personal cloud platform. The browser frontend calls independent Fastify services for auth, workspace files, runtime containers, agent tasks, memory, automation, and publishing.

The intended architecture is service-oriented, but current implementation is closer to a shared-database monolith split into processes: each service imports `@pcp/db` directly and queries tables itself.

## High-Level Flow

1. User opens `apps/web`.
2. Next proxy in `apps/web/src/proxy.ts` checks for a `sessionId` cookie and redirects unauthenticated users.
3. Client components use TanStack Query and axios clients from `apps/web/src/lib/api.ts`.
4. Services validate `sessionId` cookies locally by reading `sessions` from the shared DB.
5. Service handlers call local service classes, which read/write Drizzle tables in `packages/db`.
6. File content goes to MinIO/S3; runtime and publish operations go to Docker; automations use Redis/BullMQ.

## Frontend Architecture

- Routing lives under `apps/web/src/app`.
- Main protected UI is under `apps/web/src/app/(main)`.
- Auth pages are under `apps/web/src/app/(auth)`.
- `apps/web/src/components/app-shell/app-shell.tsx` wraps protected routes with sidebar, keyboard shortcuts, canvas, and error boundary.
- Workspace IDE layout lives in `apps/web/src/components/workspace/workspace-shell.tsx`.
- Shared UI primitives live in `apps/web/src/components/ui`.
- Workspace state lives in `apps/web/src/store/workspace.ts`.

## Backend Service Pattern

The common service entrypoint pattern is:

- `src/index.ts`: Fastify app, plugins, health route, route registration.
- `src/routes.ts` or `src/routes/*`: Zod-backed HTTP handlers.
- `src/service.ts`: business logic and database operations.

Examples:

- `services/auth/src/routes.ts` -> `services/auth/src/service.ts`.
- `services/workspace/src/routes.ts` -> `services/workspace/src/service.ts`.
- `services/runtime/src/routes.ts` -> `services/runtime/src/service.ts`.
- `services/publish/src/routes.ts` -> `services/publish/src/service.ts`.

The repository rule says repository -> service -> route, but there are no repository modules yet. Services currently call Drizzle directly.

## Data Ownership

- `packages/db` owns schema and database connection.
- All services import DB tables directly from `@pcp/db/src/schema`.
- Tenant scoping is usually enforced with `userId` or `workspaceId` filters, but there are important gaps in publish and automation routes.
- There is no API gateway or service auth layer; the browser can call each service directly.

## Auth Flow

- `services/auth/src/service.ts` creates random session IDs with `crypto.randomBytes`.
- Session cookies are set by auth routes and read by other services.
- `apps/web/src/proxy.ts` does a cookie-existence check, not a server-side session validation.
- Other services validate the cookie by reading `sessions` and `users`.
- Admin access is currently gated by `ADMIN_EMAIL` in `services/auth/src/routes/admin.ts`.

## Agent Architecture

- `services/agent/src/orchestrator.ts` manages chat and task execution.
- LLM providers are abstracted behind `LLMProvider`.
- Tool definitions are registered in `services/agent/src/tools/registry.ts`.
- Current default tools are `read_file`, `write_file`, `list_files`, and `run_command`.
- Tool execution records are written to `tool_calls`.
- Human approval flow exists conceptually through `approval_requests`, `tool_calls`, and `/agent/tasks/:id/tool-approval`.
- Current tool implementations are simulated and do not yet call workspace/runtime services.

## Runtime Architecture

- Runtime service creates Docker containers using `services/runtime/src/provider/docker.ts`.
- Containers mount a host workspace path into `/workspace`.
- Commands execute through Docker exec.
- Terminal attach returns Docker attach streams, but route-level WebSocket/SSE behavior should be reviewed before relying on it.
- Sandbox settings are partial: network is disabled, CPU/memory can be set, but non-root user, read-only rootfs, pids, capabilities, seccomp, and AppArmor are not yet enforced.

## Workspace Architecture

- Workspace service stores metadata in `workspace_files` and content in S3/MinIO.
- File APIs use path traversal checks and workspace ownership checks.
- Starter files are seeded on workspace creation.
- Snapshots create DB rows, but archive and restore are mocked/simplified.

## Publish Architecture

- Publish service stores hosted services in `hosted_services`.
- Starting a service creates a Docker container with Traefik labels and updates status asynchronously.
- It expects workspace files to exist at `/tmp/workspaces/<workspaceId>`.
- Auth is not cookie-derived in routes; routes accept `userId` from request input.

## Architecture Risks

- Service boundaries are process boundaries only; all services share direct DB access.
- Auth/session validation is duplicated across services.
- API response shapes are inconsistent and often use `as any`.
- Security invariants in `.cursor/rules/*.mdc` are not consistently reflected in source.
- Several features advertised in README exist as UI or table shape but remain simplified in service behavior.

