# Testing

*Last mapped: 2026-04-27*

## Framework
- **Vitest** in every service: `auth`, `workspace`, `runtime`, `agent`, `memory`, `publish`.
- Each service has its own `vitest.config.ts`.
- `apps/web` and `packages/shared` have **no tests**.
- Root smoke runner: `scripts/baseline-smoke.mjs` (+ `baseline-smoke.test.mjs`).

## Vitest Versions (do not unify casually)
| Package                        | Vitest pinned at |
|--------------------------------|------------------|
| `services/auth`                | `^4.1.5`         |
| `services/workspace`           | `^4.1.5`         |
| `services/runtime`             | `^1.4.0`         |
| `services/agent`               | `^1.4.0`         |
| `services/memory`              | `^1.4.0`         |
| `services/publish`             | `^1.4.0`         |

API surface differs between v1 and v4 — keep aligned only when intentional.

## Layout
- **Co-located unit tests:** `services/<svc>/src/service.test.ts` and `services/<svc>/src/orchestrator.test.ts` (agent).
- **Route tests:** e.g. `services/publish/src/routes.test.ts`.
- **Suite folders:** `services/auth/src/__tests__/*.test.ts`.

## Run Commands
```bash
# All services that define tests
pnpm test

# One service
pnpm --filter @pcp/workspace-service test

# One file
pnpm --filter @pcp/workspace-service exec vitest run src/service.test.ts

# Watch mode
pnpm --filter @pcp/agent-service exec vitest
```

`pnpm test` from the root runs `vitest run` only in services that define a `test` script.

## What's Covered
- Auth: hashing, login flow happy paths, session basics, route surface.
- Workspace: file CRUD service-level paths and basic route checks.
- Runtime: provider interface paths (Docker provider tests).
- Agent: orchestrator step machine; basic tool dispatch.
- Memory: embedding/search service paths.
- Publish: route surface and service paths.

> Coverage instrumentation is **not** wired up at the workspace level (`docs/PROGRESS.md` shows "Test coverage: 0%" — meaning unmeasured, not unwritten).

## Mocking
- In-process Vitest mocks for external SDKs and DB clients in service tests.
- Real Postgres / Redis / S3 are **not** assumed by the service test suites — use mocks or stubs.
- Smoke run (`scripts/baseline-smoke.mjs`) does the actual end-to-end touch (`/health`) against running services.

## Smoke Test (root)
```bash
pnpm smoke:local
```
And against full infra:
```bash
cp infra/docker/.env.example infra/docker/.env
pnpm infra:up
pnpm --filter @pcp/db migrate
curl -fsS http://localhost:300{1..6}/health
```

## Gaps / Known Weak Spots
- No frontend test framework (`apps/web`).
- No shared-package tests (`packages/shared`).
- No coverage thresholds enforced in CI (no CI config in repo at this snapshot).
- Several agent tools (`run_command`, `read_file`, `list_files`) return **simulated** strings; tests around these should not rely on those values being real (CONCERNS.md).
- Env-validation tests are missing — many services still read `process.env` raw.

## Conventions for New Tests
- Co-locate unit tests next to the unit (`<x>.ts` ↔ `<x>.test.ts`).
- Use `__tests__/` only when grouping multiple integration scenarios.
- Tests must respect tenant scoping — assert `userId` filter is applied.
- Avoid hitting real Docker / Postgres in unit tests; isolate via the provider abstractions (`RuntimeProvider`, `LLMProvider`, embeddings).
- For routes, prefer `fastify.inject()` to test handler+schema together.
