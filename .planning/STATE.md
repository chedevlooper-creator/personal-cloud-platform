# State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-27)

**Core value:** A user can safely run and manage a persistent AI-assisted workspace in the browser without losing data, crossing tenant boundaries, or executing unapproved risky actions.

**Current focus:** Phase 2 - Auth, Admin, Secrets, Tenant Isolation

## Current Position

- Old root GSD artifacts were archived under `.planning/archive/legacy-20260427-reset/`.
- Fresh codebase map was created under `.planning/codebase/`.
- New active requirements are in `.planning/REQUIREMENTS.md`.
- New active roadmap is in `.planning/ROADMAP.md`.
- Phase 1 context, research, and three executable plans have been created and executed for pure local checks.
- `pnpm smoke:local` now passes.
- Docker-backed BASE-02/BASE-03 verification is blocked in this session because `docker` is not installed.
- Phase 2 context, research, plans, and execution summaries have been created for auth/admin/provider/publish/automation hardening.
- Phase 2 local security execution passed `pnpm smoke:local`.

## Next Action

Continue Phase 2 gap closure:

1. Normalize auth/profile error shapes for AUTH-04.
2. Add route-by-route tenant verification for workspace, runtime, memory, snapshots, and agent conversations/tasks for TENANT-02/TENANT-03.
3. Keep BASE-02/BASE-03 blocked until Docker is available.

## Important Findings From Reset

- README's completed roadmap should not be treated as the active source of truth.
- Publish routes currently trust client-supplied `userId`.
- Automation routes need stronger tenant filters.
- Admin routes are permissive if `ADMIN_EMAIL` is unset.
- Several services use development secret fallbacks.
- Agent tools are simulated.
- Runtime sandboxing is partial.
- Snapshots are simplified/mocked.
- Frontend has several modules that may not match real backend behavior.

## Completed In Phase 1 Local Execution

- Added meaningful package `typecheck` scripts and root `pnpm typecheck` fan-out.
- Added `pnpm smoke:local` with typecheck, lint, and test checks.
- Added service env validation modules with production fail-closed behavior.
- Removed stale README/env references to a non-existent `apps/api` or port 4000 gateway.
- Added missing local Vitest configs to prevent parent directory config leakage.
- Phase 2: admin routes fail closed without `ADMIN_EMAIL`.
- Phase 2: provider credential responses no longer spread encrypted DB rows.
- Phase 2: publish APIs derive `userId` from session instead of client body/query.
- Phase 2: automation update/delete/run/history routes scope by authenticated owner.

## Workflow Config

- Mode: interactive
- Granularity: standard
- Parallelization: enabled
- Planning docs: committed by default
- Research: enabled
- Plan check: enabled
- Verifier: enabled
- Text mode: enabled for Codex compatibility
- Worktrees: disabled for simpler local execution in this dirty working tree

## Session Notes

- The working tree had pre-existing unrelated `.agent` deletions and `.codex`/README/AGENTS changes before this reset.
- Those unrelated changes were not reverted.
- Planning artifacts were written without committing because the working tree already contains unrelated changes.

---

_Last updated: 2026-04-27 after Phase 2 security execution_
