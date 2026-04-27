---
phase: 01-baseline-health-and-runtime-config
plan: 03
subsystem: infra
tags: [smoke, docker, drizzle, docs]
requires:
  - phase: 01-baseline-health-and-runtime-config
    provides: package health commands and service env validation
provides:
  - pure local baseline smoke command
  - Docker-backed infra and migration smoke instructions
  - corrected env example with explicit service URLs
affects: [infra, database, docs, release-readiness]
tech-stack:
  added: []
  patterns:
    - pure local smoke avoids Docker and fails on the first failing command
key-files:
  created:
    - scripts/baseline-smoke.mjs
    - services/memory/vitest.config.ts
    - services/runtime/vitest.config.ts
  modified:
    - package.json
    - README.md
    - infra/docker/.env.example
    - services/auth/vitest.config.ts
    - services/publish/vitest.config.ts
    - services/memory/src/service.test.ts
key-decisions:
  - 'Keep Docker-backed infra checks documented separately because Docker is not available in the current environment.'
  - 'Use local Vitest configs to prevent tests from loading a parent directory config outside this repo.'
patterns-established:
  - '`pnpm smoke:local` runs pnpm version, typecheck, lint, and tests without starting Docker.'
requirements-completed: []
requirements-blocked: [BASE-02, BASE-03]
duration: same-session
completed: 2026-04-27
---

# Phase 1 Plan 03 Summary

**The repo has a passing pure local smoke gate; Docker-backed infra and migration verification is documented but blocked locally by missing Docker.**

## Accomplishments

- Added `scripts/baseline-smoke.mjs` and root `pnpm smoke:local`.
- Updated README with pure local smoke and Docker-backed infra/migration smoke sequences.
- Replaced stale `API_URL=http://localhost:4000` assumptions in `infra/docker/.env.example` with explicit service URLs used by the web app.
- Added missing local Vitest configs for memory/runtime and allowed no-test service scripts for runtime/publish to exit cleanly.
- Adjusted memory service test mocking so it does not require a live database just to import service code.

## Verification

- `pnpm smoke:local` passed end to end.
- `pnpm -r --if-present test` passed.
- `docker --version` failed with `command not found`, so `pnpm infra:up` and `pnpm --filter @pcp/db migrate` were not run in this environment.
- `infra/docker/.env` was missing and was not created because Docker verification could not proceed.

## Next Step

Run the Docker-backed sequence from README on a machine/session with Docker available:

```bash
cp infra/docker/.env.example infra/docker/.env
pnpm infra:up
pnpm --filter @pcp/db migrate
```

## Commits

No commits were created because the working tree already contained unrelated user/Codex changes.
