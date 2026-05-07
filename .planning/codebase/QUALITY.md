# Quality

> Source: graphify-out audit (~1.4% phantom edges, cleaned), `2026-05-02-cloudmind-superpowers-gap-audit.md`, file counts.
> Last updated: 2026-05-06

## Test Coverage by Service

| Service | TS files | Tests | Ratio |
|---|---|---|---|
| auth | 15 | 8 | strong |
| workspace | 13 | 4 | medium |
| runtime | 11 | 3 | medium |
| agent | 64 | 14 | weak relative to surface |
| memory | 10 | 3 | medium |
| publish | 16 | 7 | medium |
| browser | 7 | 3 | medium |
| **Total** | **136** | **42** | **31%** |

**Frontend (`apps/web`):** 0 tests. No `test` script defined.
**Shared (`packages/shared`):** 0 tests.

## Strengths

- Strict TS settings repo-wide (`noUncheckedIndexedAccess`, `noImplicitOverride`, `isolatedModules`).
- Per-service vitest discipline; CI runs typecheck → lint → test.
- Drizzle migrations are version-controlled in `packages/db/src/migrations/`.
- Custom seccomp profile for runtime sandboxing (`infra/docker/seccomp-runtime.json`).
- Idempotent seed (`packages/db/src/seed.ts`).
- pino structured logs with correlation IDs.
- Atomic commits in recent history (`feat:`, `fix:`, `test:`, `ci:`, `docs:` conventional prefixes).
- A previous `superpowers gap audit` exists — the team self-audits.

## Weaknesses (cross-cutting)

| Area | Issue | Evidence |
|---|---|---|
| **Error envelope** | Services throw plain `Error` for not-found/client cases — domain errors become 500s | `packages/shared/src/errors.ts`, `services/runtime/src/service.ts`, `services/publish/src/service.ts`, `services/agent/src/orchestrator.ts` |
| **Error leakage** | Some catch paths surface internal driver/upstream details | `services/browser/src/routes.ts`, `services/workspace/src/routes/datasets.ts` |
| **Layer leak** | Routes still doing direct DB work | `services/auth/src/routes/profile.ts`, `services/auth/src/routes/admin.ts`, `services/agent/src/routes/automation.ts` |
| **Auth inconsistency** | Snapshot routes don't use central auth helper | `services/workspace/src/routes/snapshots.ts` |
| **Tenant backstop** | App-only enforcement; no Postgres RLS | `packages/db/src/schema/*` |
| **Rate limit scope** | Per-process limiters; multi-instance leakage | `services/workspace/src/index.ts`, `services/agent/src/rate-limit.ts` |
| **Frontend tests** | Zero | `apps/web` has no test script |
| **README drift** | "API at :4000", "apps/api", `/health` curl — none real | README vs. actual file tree |

## Code Smells (from graphify, post-cleanup)

- **Duplicated `normalizeProfileValue`** — defined separately in `services/runtime/src/policy.ts:79` and `services/publish/src/policy.ts`. Should live in `@pcp/shared`.
- **`MainCanvas` ↔ `Sidebar` shares-data via custom events** — possible prop drilling or coordination via DOM events; consider lifting to context.
- **`toastApiError` is the only error sink (22 in-edges)** — uniform UX for errors but masks per-domain semantics.
- **`AgentOrchestrator` 38 edges** — legitimate hub but a change-amplifier; refactor with care.

## Graph Hygiene

- Graphify ran end-to-end: 2,392 nodes, 2,895 edges, 414 communities (after phantom-edge cleanup).
- 42 phantom edges removed (mostly `INFERRED` cross-package shared-helper false-positives, plus 2 confirmed false `EXTRACTED` edges: `publish→agent.start()` and `runtime→publish.normalizeProfileValue`).
- ~1.4% phantom rate — graph is **trustworthy as a rough map, not as ground truth**. Verify before acting on `INFERRED` edges.

## Documentation State

| Doc | State |
|---|---|
| `README.md` | **Stale** — references `apps/api` and port 4000 that don't exist |
| `AGENTS.md` | **Current** — repo-specific notes, surgical edits guidance |
| `docs/CLOUDMIND_OS_PRD_AND_TECHNICAL_SPEC.md` | Exists; scope unverified |
| `docs/PROGRESS.md` | Exists; freshness unknown |
| `docs/superpowers/reports/` | Has dated audits — actively used |
| `design-system/MASTER.md` | Reachable; god-node in graph |

## CI / Smoke

- `.github/workflows/` — typecheck, lint, test on push.
- `scripts/baseline-smoke.mjs` — local smoke gate.
- Vitest version drift (auth/workspace on v4, others on v1) — known and intentional.
