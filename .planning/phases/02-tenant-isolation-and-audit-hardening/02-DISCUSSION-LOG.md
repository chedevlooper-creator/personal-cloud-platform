# Phase 2 Discussion Log

## Trigger

The user requested `DEVAM` after Phase 1 completion. GSD next-step routing moved
from the completed foundation phase into Phase 2 planning.

## Questions Asked

None. The existing roadmap, requirements, repo rules, and Phase 1 output provide
enough constraints to continue without interrupting for clarification.

## Decisions

- Start with tenant/resource isolation before sandbox hardening because runtime
  and publish boundaries depend on correct ownership checks.
- Treat `userId` plus `workspaceId` as the tenant boundary for current code.
- Do not introduce organization support in this phase.
- Add tests around representative high-risk flows rather than attempting a
  mechanical rewrite of every query in one step.
- Keep audit data structured and low-sensitivity; no raw payloads, secrets,
  cookies, file contents, or provider credentials.

## Evidence Read

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/CONCERNS.md`
- `services/workspace/src/service.ts`
- `services/workspace/src/datasets/service.ts`
- `services/workspace/src/routes/snapshots.ts`
- `services/runtime/src/service.ts`
- `services/runtime/src/provider/docker.ts`
- `services/publish/src/service.ts`
- `services/agent/src/channels/router.ts`

## Open Follow-Ups

- During execution, confirm exact testability of Docker path/label changes
  without requiring a Docker daemon.
- During execution, decide whether snapshot backward compatibility needs a
  one-time migration or only read compatibility for existing rows.
