---
focus: concerns
mapped_at: 2026-04-27
last_mapped_commit: c55e9b3bb8f13d990887889dfeb3418507c7a360
---

# Concerns

## Executive Summary

The codebase has a strong skeleton, but it should be treated as MVP code rather than production-ready. The highest-priority risks are tenant isolation, auth/admin authorization, default secrets, simulated agent tools, partial sandboxing, and routes that trust client-supplied `userId`.

## Critical Or High Priority

### Publish routes trust caller-supplied user IDs

- `services/publish/src/routes.ts` accepts `userId` in request bodies or query strings.
- `services/publish/src/service.ts` correctly scopes by `userId` once given one, but the route does not derive it from the authenticated session.
- This enables user spoofing unless another gateway enforces identity before the publish service.

### Automation routes miss tenant filters on mutations and reads

- `services/agent/src/routes/automation.ts` lists automations by user, but update/delete/run/history paths use only automation ID in key queries or mutations.
- A user could potentially modify, delete, trigger, or read runs for another user's automation if they know the UUID.
- Session lookup uses a non-null assertion on `session?.expiresAt.getTime()!`.

### Admin access is permissive when `ADMIN_EMAIL` is unset

- `services/auth/src/routes/admin.ts` only rejects non-admin users if `ADMIN_EMAIL` exists and does not match.
- If `ADMIN_EMAIL` is unset, any authenticated user can pass admin checks.

### Development secret fallbacks are embedded in service startup

- Several services use `COOKIE_SECRET || 'super-secret-key-replace-in-prod'`.
- `services/auth/src/encryption.ts` defaults to a static 32-byte encryption key.
- OAuth credentials default to dummy values in `services/auth/src/routes.ts`.
- Production startup should fail if required secrets are missing.

### Agent tools are simulated

- `services/agent/src/tools/read_file.ts`, `write_file.ts`, `list_files.ts`, and `run_command.ts` return simulated results.
- The agent loop persists tasks and tool calls, but does not yet operate on real workspace files or runtime commands.
- README claims around AI chat/tool-calling should be verified against this current behavior.

## Medium Priority

### Runtime sandbox is incomplete

- `services/runtime/src/provider/docker.ts` disables networking, but does not enforce non-root users, read-only rootfs, dropped capabilities, pids limits, seccomp, AppArmor, or tmpfs-only `/tmp`.
- `services/runtime/src/service.ts` has a small command blocklist, not a full risk policy.
- Workspace host paths are hardcoded under `/tmp/workspaces/<workspaceId>`.

### Snapshot implementation is mocked

- `services/workspace/src/service.ts` creates snapshot rows and marks them ready.
- Restore logs a message and does not actually restore a tar archive.
- README describes tar.gz backup/restore behavior that is not implemented in full.

### Service boundaries are weak

- All services directly import and query `@pcp/db`.
- There is no repository layer.
- There is no internal service auth token flow.
- Frontend calls individual services directly.

### Logging may include PII

- `services/auth/src/service.ts` logs email addresses on registration/login attempts.
- Repo rules require no PII in logs.

### Type quality is below strict-config intent

- `any` and `as any` are common in services and frontend.
- `packages/shared` uses `z.any()` for several payloads.
- This weakens strict TypeScript guarantees and makes tenant/security bugs easier to miss.

### API response shapes are inconsistent

- Some routes return raw arrays, others return objects like `{ workspaces, page, limit }`.
- Errors are usually `{ error: string } as any`.
- The backend rule expects consistent `{ data, error, meta }` shapes.

## Product And UX Concerns

- Many main app pages are module placeholders.
- README says all 9 phases are implemented, but code contains placeholders, mocks, and simplified behavior.
- The app shell is coherent, but feature completeness differs by module.
- Web has no automated tests to protect UI behavior.

## Operational Concerns

- No CI workflow files were found.
- Dist artifacts and `tsbuildinfo` files are present in the repo.
- Docker network name assumptions in publish service should be verified against Compose-created network names.
- `infra/docker/.env.example` references `API_URL=http://localhost:4000`, but there is no single API gateway.

## First Fix Candidates

1. Make production startup fail on missing secrets.
2. Derive user identity from session cookies in publish routes.
3. Add `userId` filters to all automation mutations and run queries.
4. Lock admin routes when `ADMIN_EMAIL` is unset.
5. Replace simulated agent tools with real workspace/runtime service integration or explicitly mark them unavailable.
6. Add tenant isolation tests for publish, automation, workspace, runtime, memory, and agent.

