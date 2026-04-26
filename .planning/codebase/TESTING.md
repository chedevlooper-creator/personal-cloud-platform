# Testing

Last mapped: 2026-04-27

## Framework

- **Vitest** — all backend services
- Version split:
  - `^4.1.5` — auth, workspace services
  - `^1.4.0` — runtime, agent, memory, publish services
  - ⚠ **Do not unify** — APIs differ between major versions

## Test Configuration

Service-level `vitest.config.ts` files:
- `services/workspace/vitest.config.ts`
- `services/agent/vitest.config.ts`
- `services/publish/vitest.config.ts`

## Test Files

| Service   | Test File                                       | Status       |
|-----------|-------------------------------------------------|--------------|
| auth      | `services/auth/src/service.test.ts`             | ⚠ `describe.skip` — requires live DB |
| workspace | `services/workspace/src/service.test.ts`        | Present      |
| agent     | `services/agent/src/orchestrator.test.ts`       | Present      |
| memory    | `services/memory/src/service.test.ts`           | Present      |
| publish   | `services/publish/test/service.test.ts`         | Present      |
| runtime   | —                                               | **Missing**  |
| web       | —                                               | **No tests** |
| shared    | —                                               | **No tests** |

## Test Patterns

### Integration Tests (auth example)
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AuthService } from './service';
import { db } from '@pcp/db/src/client';

describe.skip('AuthService', () => {
  const logger = pino({ level: 'silent' });
  const authService = new AuthService(logger);

  beforeAll(async () => {
    await db.delete(users).where(eq(users.email, testEmail));
  });

  it('should register a new user', async () => {
    const { user, session } = await authService.register(email, password);
    expect(user.email).toBe(email);
  });
});
```

### Key Test Observations
- Tests are **integration-style** — hit real database, no mocking of DB layer
- Tests are **skipped** when DB is unavailable (`describe.skip`)
- Logger injected with `level: 'silent'` for clean test output
- No test utilities or shared test helpers
- No factory or fixture patterns

## Running Tests

```bash
# All services
pnpm test

# Single service
pnpm --filter @pcp/auth-service test
pnpm --filter @pcp/workspace-service test

# Single file
pnpm --filter @pcp/workspace-service exec vitest run src/service.test.ts
```

## Coverage

- **No coverage configuration** — no coverage thresholds, reporters, or CI enforcement
- No coverage collection enabled

## E2E Tests

- **Not implemented** — BUILD_PLAN mentions Playwright for E2E but nothing exists yet
- No frontend tests at all

## Mocking

- No mock utilities or patterns established
- Tests require live PostgreSQL connection
- No test database seeding automation

## CI/CD

- **Not configured** — no GitHub Actions workflows exist
- BUILD_PLAN mentions planned CI with lint + test on PR

## Gaps

1. **Runtime service** has zero tests
2. **Frontend** (`apps/web`) has zero tests
3. **Shared package** (`packages/shared`) has zero tests
4. Auth tests are permanently skipped (need live DB)
5. No test infrastructure for running tests in CI without manual Docker setup
6. No mocking strategy for external services (OpenAI, Anthropic, MinIO, Docker)
7. No snapshot or visual regression testing for frontend
