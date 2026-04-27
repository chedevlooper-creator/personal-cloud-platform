# Testing Patterns

**Analysis Date:** 2026-04-27

## Test Framework

**Runner:**
- Vitest.
- Config files exist in `services/auth/vitest.config.ts`, `services/workspace/vitest.config.ts`, `services/agent/vitest.config.ts`, and `services/publish/vitest.config.ts`.
- Services without explicit visible tests may still expose `test` scripts.

**Assertion Library:**
- Vitest built-in `expect`.
- Vitest mocking utilities in service tests.

**Run Commands:**
```bash
pnpm test
pnpm --filter @pcp/auth-service test
pnpm --filter @pcp/workspace-service test
pnpm --filter @pcp/agent-service test
pnpm --filter @pcp/memory-service test
pnpm --filter @pcp/auth-service exec vitest run src/service.test.ts
```

**Type Checks:**
```bash
pnpm --filter @pcp/auth-service exec tsc --noEmit
pnpm --filter @pcp/workspace-service exec tsc --noEmit
pnpm --filter @pcp/runtime-service exec tsc --noEmit
pnpm --filter @pcp/agent-service exec tsc --noEmit
pnpm --filter @pcp/publish-service exec tsc --noEmit
pnpm --filter web exec tsc --noEmit
```

Root `pnpm typecheck` is currently a no-op because packages do not define a `typecheck` script.

## Test File Organization

**Location:**
- Service tests are colocated with service source, e.g. `services/auth/src/service.test.ts`.
- Some tests live under `src/__tests__/`, e.g. `services/workspace/src/__tests__/path-traversal.test.ts`.
- `apps/web` currently has no test script.
- `packages/shared` currently has no test script.

**Naming:**
- Unit/integration tests use `*.test.ts`.
- Security-focused path tests use descriptive test names under `__tests__`.

**Current Test Files:**
- `services/auth/src/service.test.ts`
- `services/auth/src/__tests__/encryption.test.ts`
- `services/auth/src/__tests__/schemas.test.ts`
- `services/workspace/src/service.test.ts`
- `services/workspace/src/__tests__/path-traversal.test.ts`
- `services/agent/src/orchestrator.test.ts`
- `services/memory/src/service.test.ts`

## Test Structure

**Observed Pattern:**
```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('ServiceName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do something observable', async () => {
    // Arrange
    // Act
    // Assert
  });
});
```

**Repo Standard:**
- Arrange, Act, Assert.
- Behavior-oriented test names.
- Critical paths and security paths should be covered more deeply than basic CRUD.

## Mocking

**Framework:**
- Vitest `vi`.

**Observed Patterns:**
- DB objects are mocked in service tests.
- External providers should be mocked for LLM/S3/Docker/Google OAuth.
- Some repo rules prefer a real test DB for DB integration tests, but current tests are mostly unit-style mocks.

**What to Mock:**
- LLM SDK calls.
- S3/MinIO network calls.
- Dockerode container lifecycle.
- OAuth provider responses.
- Time and randomness when testing sessions, encryption, scheduling, and snapshots.

**What Not to Mock:**
- Pure schema parsing.
- Small deterministic utilities.
- Path safety behavior when direct unit tests are simpler and safer.

## Fixtures and Factories

**Current Style:**
- Tests use inline objects and helper functions rather than a shared fixture package.
- Workspace service tests define small factory helpers for mock DB rows.

**Recommended Additions:**
- Shared factories for `user`, `session`, `workspace`, `file`, `runtime`, and `task` records if tests expand.
- Keep factories near tests until duplication is meaningful.

## Coverage Expectations

**Repo Rules:**
- Unit: 70% minimum.
- Critical paths: 90%+.
- Security paths: 100%.
- New code: 80%+.

**Current Gaps:**
- No frontend component or E2E tests are visible.
- Runtime Docker provider behavior is not visibly tested.
- Publish service container/Traefik behavior is not visibly tested.
- Cross-service flows are not covered by integration/E2E tests.
- Tenant isolation is not systematically tested across every service.

## CI and Verification

**Known Commands:**
- `pnpm build` runs service/package TypeScript builds and web build.
- `pnpm lint` runs only in packages that define lint.
- `pnpm test` fans out to services that define test scripts.

**Risks:**
- Root scripts are partial fan-outs; a green root command may not mean every package was checked.
- `dist/` output is present in some packages while ignored by root `.gitignore`.

## Security Testing Targets

**Must Cover:**
- Auth brute force/rate limit and generic failure messaging.
- Cookie/session expiration and refresh behavior.
- OAuth state/PKCE once implemented.
- Workspace path traversal and tenant isolation.
- Runtime command blocking and timeout behavior.
- Agent tool approval for high-risk tools.
- Credential encryption/decryption and non-return of plaintext keys.

---
*Testing analysis: 2026-04-27*
*Update when test strategy or tooling changes*
