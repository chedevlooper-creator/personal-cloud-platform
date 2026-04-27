# Phase 1: Baseline Health And Runtime Config - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning
**Source:** Clean GSD reset from source inspection

<domain>
## Phase Boundary

Make the repository reproducible from a clean checkout and define startup rules that fail closed outside development.

This phase is about baseline reliability only. It should not fix every security finding; it should create the scripts, docs, config validation, and smoke checks that make later phases safer to execute.
</domain>

<decisions>
## Implementation Decisions

### Scope
- Treat current source as MVP baseline, not finished product.
- Do not use archived legacy planning as an implementation source.
- Preserve the existing pnpm workspace shape.
- Keep `packages/shared` source-import behavior; do not introduce a build step there in Phase 1.
- Prefer package-level scripts that make root fan-out commands meaningful.
- Do not start Docker or mutate local infra automatically inside package scripts unless the script name clearly says it is an infra check.

### Config Validation
- Production startup must fail if required secrets are missing.
- Development may keep explicit local defaults only where they are marked as development-only.
- Env validation should be service-local or shared through a tiny internal helper only if that helper does not create a cross-service runtime dependency problem.
- Do not solve all auth/tenant issues in this phase; expose them as failing or pending checks for Phase 2.

### Artifact Hygiene
- Decide whether generated `dist` and `*.tsbuildinfo` artifacts should remain tracked.
- If they are not intentionally tracked, Phase 1 should update ignore rules and remove tracked generated outputs from git index.
- Avoid touching unrelated `.agent` deletions that were present before this reset.

### Verification
- Verification must include concrete commands for install-free local checks where possible.
- Docker-dependent checks may be documented as manual or separate smoke commands.
- Keep Phase 1 non-UI.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### GSD Baseline
- `.planning/PROJECT.md` - active project definition.
- `.planning/REQUIREMENTS.md` - Phase 1 requirement IDs.
- `.planning/ROADMAP.md` - Phase 1 goal and success criteria.
- `.planning/codebase/STACK.md` - package and command shape.
- `.planning/codebase/TESTING.md` - current testing gaps and commands.
- `.planning/codebase/CONCERNS.md` - risks this phase should expose but not fully solve.

### Repo Config
- `package.json` - root scripts.
- `pnpm-workspace.yaml` - workspace package globs.
- `tsconfig.base.json` - strict backend TypeScript config.
- `.gitignore` - generated artifact policy.
- `README.md` - command documentation that may be stale.

### Infra And DB
- `infra/docker/docker-compose.yml` - local infrastructure stack.
- `infra/docker/.env.example` - local env template.
- `packages/db/drizzle.config.ts` - migration env validation pattern.
- `packages/db/src/client.ts` - DB client env validation pattern.

### Services
- `services/auth/src/index.ts` - cookie secret and startup pattern.
- `services/workspace/src/index.ts` - service startup pattern.
- `services/runtime/src/index.ts` - service startup pattern.
- `services/agent/src/index.ts` - env loader and startup pattern.
- `services/memory/src/index.ts` - service startup pattern.
- `services/publish/src/index.ts` - service startup pattern.
</canonical_refs>

<specifics>
## Specific Ideas

- Add package-level `typecheck` scripts so `pnpm typecheck` stops being a no-op.
- Add a clear baseline verification script or README section listing exact commands.
- Align README with actual services and remove stale single API gateway references.
- Introduce env validation that rejects production defaults for `COOKIE_SECRET`, `ENCRYPTION_KEY`, provider keys, and service URLs where appropriate.
- Add smoke commands for Compose health and DB migration readiness.
</specifics>

<deferred>
## Deferred Ideas

- Publish route identity hardening belongs to Phase 2.
- Full runtime sandbox policy belongs to Phase 4.
- Real snapshots belong to Phase 3.
- Agent tool implementation belongs to Phase 5.
- Frontend placeholder cleanup belongs to Phase 7.
</deferred>

---

*Phase: 01-baseline-health-and-runtime-config*
*Context gathered: 2026-04-27 via clean GSD reset*

