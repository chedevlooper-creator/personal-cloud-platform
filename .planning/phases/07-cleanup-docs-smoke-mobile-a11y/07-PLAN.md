# Phase 7 Plan — Cleanup, Docs, Smoke, Mobile, A11y

**Goal:** Catch remaining audit P1 items in a single brownfield cleanup sweep.

## Tasks

1. Extend static security audits to enforce direct DB access inventory and prevent unreviewed route-level DB work.
2. Move `normalizeProfileValue` to `@pcp/shared` and update runtime/publish to import it.
3. Add Redis-backed rate-limit unit coverage and auth/agent distributed-capable configuration checks.
4. Remove chat panel toggle/new-chat event loops by routing command palette and shortcuts through `ChatPanelProvider`; keep cross-tree custom events only for file/code attachment flows.
5. Make files page usable on mobile/tablet by exposing the file tree instead of hiding all browsing controls below `lg`.
6. Add admin explicit error states and responsive rows/tabs for 375 px and 768 px widths.
7. Add lightweight frontend smoke coverage for the top flows or a deterministic smoke contract when live services are unavailable.
8. Rewrite README stale health/smoke sections and verify no stale `apps/api` or `:4000` references remain.
9. Run typecheck, lint, tests, and update Phase 7 state/summary.

## Verification

- `pnpm --filter @pcp/db exec vitest run src/tenant-isolation-audit.test.ts`
- `pnpm --filter @pcp/shared exec vitest run src/rate-limit.test.ts src/env-helpers.test.ts`
- `pnpm --filter web test`
- `pnpm smoke:web`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`

## Outcome

Completed on 2026-05-08. Final verification passed:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm smoke:web`
