---
focus: quality
mapped_at: 2026-04-27
last_mapped_commit: c55e9b3bb8f13d990887889dfeb3418507c7a360
---

# Testing

## Test Stack

- Vitest is used for backend services.
- `services/auth` and `services/workspace` use Vitest `^4.1.5`.
- `services/agent`, `services/memory`, `services/runtime`, and `services/publish` use Vitest `^1.4.0`.
- The web app has no test script.
- `packages/shared` has no test script.

## Existing Tests

| Area | Files |
|------|-------|
| Auth service | `services/auth/src/service.test.ts`, `services/auth/src/__tests__/encryption.test.ts`, `services/auth/src/__tests__/schemas.test.ts` |
| Workspace service | `services/workspace/src/service.test.ts`, `services/workspace/src/__tests__/path-traversal.test.ts` |
| Agent service | `services/agent/src/orchestrator.test.ts` |
| Memory service | `services/memory/src/service.test.ts` |

## Test Commands

- All service tests: `pnpm test`.
- Single service: `pnpm --filter @pcp/auth-service test`.
- Single file example: `pnpm --filter @pcp/workspace-service exec vitest run src/service.test.ts`.
- Typecheck service: `pnpm --filter @pcp/auth-service exec tsc --noEmit`.
- Web lint: `pnpm --filter web lint`.

## Important Command Gotcha

Root `pnpm typecheck` currently fans out to package `typecheck` scripts, but packages do not define a `typecheck` script. Use per-package `tsc --noEmit` commands instead.

## Coverage Gaps

- No frontend unit/component tests for `apps/web`.
- No Playwright/E2E tests for core user journeys.
- No publish service tests.
- Runtime service has no visible tests for Docker provider behavior or command policy.
- Memory service testing likely needs provider mocking and pgvector behavior coverage.
- Cross-service integration tests are not present.
- Tenant isolation tests are incomplete for publish and automation.
- Security tests are narrow and focus mainly on encryption and workspace path traversal.

## Risk-Based Test Priorities

1. Auth/session and admin authorization tests.
2. Tenant isolation tests for every service route.
3. Workspace file CRUD and object key ownership tests.
4. Runtime sandbox policy tests.
5. Agent tool approval and task lifecycle tests.
6. Automation CRUD/run ownership tests.
7. Publish service user spoofing and container lifecycle tests.
8. Frontend smoke tests for login, dashboard, workspace, chat, terminal, automations, hosting, settings.

## CI State

- No `.github/workflows` files were found in the scanned file list.
- Build/test/lint gates appear to be local scripts only.
- Generated `dist` and `tsbuildinfo` files exist in the tree; CI should clarify whether these are intended to be tracked.

## Manual Verification Needs

- Docker Compose stack startup with `pnpm infra:up`.
- Database migration with `pnpm --filter @pcp/db migrate`.
- Service startup on ports 3001-3006 and web on 3000.
- Browser verification of auth flow and workspace shell.
- Runtime command execution and terminal attachment.
- Hosted service creation through Docker and Traefik route resolution.

