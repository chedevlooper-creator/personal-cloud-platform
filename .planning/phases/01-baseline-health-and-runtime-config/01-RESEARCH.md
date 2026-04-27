# Phase 1: Baseline Health And Runtime Config - Research

**Researched:** 2026-04-27
**Mode:** Inline codebase research

## Summary

Phase 1 should make baseline commands honest and startup behavior predictable. The root repo already declares `dev`, `build`, `lint`, `test`, `typecheck`, and infra scripts, but `typecheck` is ineffective because package-level `typecheck` scripts are missing.

The strongest implementation pattern already present is Zod env validation in `packages/db/drizzle.config.ts` and `packages/db/src/client.ts`. Service startup should adopt the same fail-fast pattern rather than scattered `process.env` reads with production-unsafe defaults.

## Findings

### Command Baseline

- Root `package.json` uses pnpm recursive fan-out.
- Package scripts are inconsistent:
  - Services have `dev`, `build`, `start`, `test`.
  - Web has `dev`, `build`, `start`, `lint`.
  - `packages/db` has `build`, `dev`, `lint`, migration scripts.
  - `packages/shared` has no scripts.
- No package defines `typecheck`, so root `pnpm typecheck` is currently a no-op.

### Generated Artifacts

- `services/*/dist` exists for several services.
- `*.tsbuildinfo` files exist under services/packages/web.
- Generated artifacts should either be intentionally tracked or ignored and removed from index.

### Env Validation

- `packages/db` already uses Zod env validation.
- Services use direct `process.env` reads.
- Cookie secrets and encryption key have default fallback values.
- Agent service loads `.env.local`, root `.env.local`, service `.env`, root `.env`, and `infra/docker/.env`.

### Infra Baseline

- Compose stack includes pgvector/Postgres, Redis, MinIO, Traefik, and Mailhog.
- `.env.example` includes `API_URL=http://localhost:4000`, but there is no single API gateway.
- Service ports are 3001 auth, 3002 workspace, 3003 runtime, 3004 agent, 3005 memory, 3006 publish, and 3000 web.

## Recommended Plan Shape

1. Add honest package scripts and artifact ignore policy.
2. Add service env validation/fail-closed startup behavior.
3. Add baseline smoke documentation or script for infra, migrations, and package commands.

## Verification Strategy

- Run `pnpm -r --if-present typecheck` after scripts are added.
- Run package-specific `tsc --noEmit` where needed.
- Run `pnpm test`.
- Run `pnpm lint`.
- Run `pnpm --filter @pcp/db exec tsc --noEmit`.
- For infra smoke, use documented manual commands unless Docker is known to be running.

## Pitfalls

- Do not make `packages/shared` require a build output; consumers import from `src`.
- Do not introduce env validation that breaks test runners without a test/dev fallback.
- Do not change service ports without updating frontend env defaults.
- Do not touch unrelated pre-existing `.agent` worktree changes.

---

*Ready for planning: yes*

