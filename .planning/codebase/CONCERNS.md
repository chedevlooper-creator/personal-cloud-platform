# Concerns

Last mapped: 2026-04-27

## Technical Debt

### HIGH — Session Validation Duplication
Every service (`auth`, `workspace`, `runtime`, `agent`, `memory`) duplicates the same `validateUserFromCookie` method — querying `sessions` and `users` tables directly. This should be extracted into shared middleware or a dedicated auth client.

**Affected files:**
- `services/auth/src/service.ts`
- `services/workspace/src/service.ts`
- `services/runtime/src/service.ts`
- `services/agent/src/orchestrator.ts`
- `services/memory/src/service.ts`

### HIGH — No API Gateway
Each service exposes its own HTTP port. The frontend presumably needs to know all 6 ports. No unified API gateway exists. The README references `apps/api` (NestJS gateway) but this directory was never created. The `BUILD_PLAN.md` mentions it but it's stale.

### MEDIUM — Untyped Logger
All service classes accept `private logger: any` — no typed Pino logger. This prevents type-safe logging and IDE autocompletion.

### MEDIUM — Stale Duplicate Files
Several duplicate files exist with spaces in names:
- `apps/web/src/app/(main)/dashboard/page 2.tsx`, `page 3.tsx`
- `apps/web/src/app/(main)/workspace/[id]/page 2.tsx`
- `apps/web/src/app/(main)/apps/page 2.tsx`
- `apps/web/src/app/(main)/layout 2.tsx`
- `apps/web/src/components/workspace/file-tree 2.tsx`
- `apps/web/src/components/workspace/editor 2.tsx`
- `apps/web/src/lib/auth 2.ts`
- `services/workspace/src/service 2.ts`
- `services/workspace/src/service.test 2.ts`

These appear to be accidental duplicates and should be cleaned up.

### MEDIUM — Missing Repository Layer
All services embed Drizzle queries directly in service classes. The architecture rules specify a `repository → service → route` layering but repositories don't exist yet.

### LOW — `drizzle-orm: "latest"` in Some Services
Runtime, agent, memory services pin `drizzle-orm` to `"latest"` instead of `^0.45.2`. This creates reproducibility risk.

## Security Concerns

### HIGH — Hardcoded Cookie Secrets
All services use a default cookie secret:
```typescript
secret: process.env.COOKIE_SECRET || 'super-secret-key-replace-in-prod'
```
This is fine for development but dangerous if deployed without proper env configuration.

### HIGH — No CORS Restrictions
All services set:
```typescript
cors({ origin: true, credentials: true })
```
This allows any origin to make authenticated requests — acceptable for local dev, dangerous in production.

### MEDIUM — Dummy API Keys
LLM providers fall back to `'dummy_key'` when env vars are missing:
```typescript
env.OPENAI_API_KEY || 'dummy_key'
```
This silently fails rather than crashing at startup.

### MEDIUM — No Input Sanitization
Path traversal protection exists in workspace service (`normalizeFilePath`), but there's no validation that paths don't contain `..`. The normalize function only ensures leading `/`.

### MEDIUM — Agent `.env.local` Exposed
`services/agent/.env.local` (338 bytes) exists and may contain secrets. It's in `.gitignore` but its presence suggests credentials are stored locally.

### LOW — SQL Injection Surface
Memory service uses `sql` template literals with string interpolation for vector search:
```typescript
const embeddingStr = `[${queryEmbedding.join(',')}]`;
```
While `queryEmbedding` comes from the embedding provider (not user input), this pattern is fragile.

## Performance Concerns

### MEDIUM — No Connection Pooling Strategy
Each service imports `@pcp/db/src/client.ts` which creates its own pool. If multiple services run in the same process during tests, multiple pools compete.

### MEDIUM — No Caching
No Redis integration in any service code despite Redis being in Docker Compose. Session validation hits DB on every request.

### LOW — Workspace File Listing
`WorkspaceService.listFiles` loads ALL files for a workspace then filters in JavaScript:
```typescript
const files = await db.query.workspaceFiles.findMany({
  where: and(eq(workspaceFiles.workspaceId, workspaceId), isNull(workspaceFiles.deletedAt)),
});
return files.filter((file) => file.parentPath === parentPathCondition);
```
This should be filtered at the database level.

## Fragile Areas

### Agent Orchestrator
- Single tool call per iteration (only processes `toolCalls[0]`)
- Tool output parsed with `JSON.parse(toolCall.arguments)` — no error handling for malformed JSON
- Max 15 iterations hardcoded — should be configurable
- `fire & forget` pattern for agent loop — if the process crashes, task state is inconsistent

### Publish Service
- No tenant scoping on `deleteApp`, `getDeployments` — any user could interact with any app
- Hardcoded network name `pcp_network` vs Docker Compose's `pcp-network`
- No cleanup of orphaned containers on failed deployments

### Runtime Service
- Dummy workspace path: `const hostWorkspacePath = '/tmp/workspaces/${workspaceId}'`
- No resource limits applied to containers
- No security profiles (seccomp/apparmor) despite being in BUILD_PLAN

## Missing Features (per BUILD_PLAN)

1. **No API gateway** — `apps/api` never created
2. **No Redis integration** — pub/sub, caching not implemented
3. **No MFA/TOTP** — planned but not built
4. **No rate limiting on most services** — only auth has it
5. **No OpenTelemetry** — no tracing infrastructure
6. **No Prometheus metrics** — no metrics collection
7. **No CI/CD pipeline** — no GitHub Actions
8. **Only 1 agent tool** (ReadFile) — BUILD_PLAN calls for 5-10
9. **No tool approval workflow** — UI component exists but backend doesn't support it
10. **No real-time updates** — no WebSocket or SSE implementation for agent task streaming
