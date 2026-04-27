---
phase: 01-baseline-health-and-runtime-config
plan: 01
subsystem: tooling
tags: [pnpm, typescript, nextjs, eslint, docs]
requires: []
provides:
  - meaningful root and per-package typecheck scripts
  - accurate README baseline command documentation
  - DB package ESLint flat config so configured lint scripts run
affects: [testing, docs, release-readiness]
tech-stack:
  added: [eslint, typescript-eslint]
  patterns:
    - package scripts must represent executable checks, not stale placeholders
key-files:
  created:
    - packages/db/eslint.config.mjs
  modified:
    - package.json
    - apps/web/package.json
    - services/*/package.json
    - packages/db/package.json
    - packages/shared/package.json
    - README.md
    - pnpm-lock.yaml
key-decisions:
  - 'Use `next typegen && tsc --noEmit` for web typecheck because this repo uses Next.js 16 route typing.'
  - 'Keep `packages/shared` as source-imported TypeScript with typecheck only; no build/dist expectation was added.'
patterns-established:
  - 'Root `pnpm typecheck` fans out to package `typecheck` scripts with `--if-present`.'
requirements-completed: [BASE-01]
duration: same-session
completed: 2026-04-27
---

# Phase 1 Plan 01 Summary

**Executable package health commands now match the monorepo's real packages and Next.js 16 setup.**

## Accomplishments

- Added `typecheck` scripts across web, services, db, and shared packages.
- Changed root `pnpm typecheck` from a no-op into a recursive fan-out.
- Updated README command examples to include the memory service and current package filter names.
- Added a DB package ESLint flat config so its existing `lint` script is runnable under ESLint 9.

## Deviations from Plan

- Added `packages/db/eslint.config.mjs` and DB lint dev dependencies after `pnpm smoke:local` exposed that the existing `packages/db` lint script could not run without an ESLint 9 flat config.
- Fixed existing web lint errors that blocked the new smoke command: removed `any` from touched frontend response shapes and replaced three effect-driven synchronous state resets with event/derived state patterns.

## Verification

- `pnpm --filter @pcp/db lint` passed.
- `pnpm --filter web typecheck` passed.
- `pnpm --filter web lint` passed with warnings only.
- Final `pnpm smoke:local` passed.

## Commits

No commits were created because the working tree already contained unrelated user/Codex changes.
