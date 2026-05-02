# CloudMind OS Superpowers Gap Audit

Date: 2026-05-02

## Purpose

This is the current Superpowers audit baseline for CloudMind OS after the
repo-local generated planning layer was removed. It consolidates read-only
multi-agent review across frontend, backend/security, infra/testing, and
Superpowers workflow usage.

No application files were changed during this audit.

## Current State

- Branch: `master`, ahead of `origin/master` by the scaffold-removal commit.
- Local stash: empty at audit time.
- Superpowers records now live under `docs/superpowers/`.
- Verification gates were not run in this audit because dependencies are not
  installed in this checkout.

## Superpowers Operating Model

Use Superpowers as a lightweight method, not as repo-local generated machinery:

1. Use `docs/superpowers/reports/` for read-only audits.
2. Use `docs/superpowers/specs/` for approved designs.
3. Use `docs/superpowers/plans/` for implementation plans.
4. Use parallel agents for independent read-only domains.
5. Use subagent-driven development only after a written plan exists and tasks
   have disjoint write scopes.

Do not use subagents for ambiguous architecture decisions, dirty worktree
reconciliation, shared database/package migrations, or tasks where several
agents would edit the same files.

## Audit Agent Split

Recommended read-only audit split for future runs:

| Agent | Scope | Output |
| --- | --- | --- |
| Auth/Tenant | sessions, cookies, internal service tokens, tenant checks | finding, evidence, risk, verification |
| DB Isolation | schema, migrations, row ownership, query filters | finding, evidence, risk, verification |
| Runtime/Publish | Docker policy, command execution, hosted services | finding, evidence, risk, verification |
| Agent/Memory/Tools | tool approval, task lifecycle, memory, browser tools | finding, evidence, risk, verification |
| Frontend/UX | app shell, chat, settings, hosting, automations, accessibility | finding, evidence, risk, verification |
| Infra/Test/Docs | CI, smoke, env setup, deployment docs, backup scripts | finding, evidence, risk, verification |

## Priority Findings

### P1 Backend And Security

| Finding | Evidence | Risk | Suggested slice |
| --- | --- | --- | --- |
| Domain errors can become 500 responses because services throw plain `Error` for not-found/client cases. | `packages/shared/src/errors.ts`, `services/runtime/src/service.ts`, `services/publish/src/service.ts`, `services/agent/src/orchestrator.ts` | User-correctable failures look like server failures; frontend cannot reliably recover. | Define service error classes and route tests for runtime, publish, and agent. |
| Some custom catch paths can leak internal 500 messages. | `services/browser/src/routes.ts`, `services/workspace/src/routes/datasets.ts` | Internal driver or upstream details can reach clients. | Route-level error envelope hardening with regression tests. |
| Internal service token plus arbitrary `X-User-Id` is broad impersonation. | `packages/db/src/auth-request.ts`, `services/agent/src/clients/http.ts`, `services/runtime/src/workspaceClient.ts` | Token compromise gives cross-user action capability. | Add audience/service scoping, rotation path, and explicit network boundary docs. |
| Auth resolution is inconsistent between workspace route groups. | `services/workspace/src/routes.ts`, `services/workspace/src/routes/snapshots.ts` | Future internal calls or auth bypass behavior can diverge by route. | Normalize snapshot routes onto the central auth helper. |
| Route layers still do direct DB work. | `services/auth/src/routes/profile.ts`, `services/auth/src/routes/admin.ts`, `services/agent/src/routes/automation.ts` | Tenant filtering is harder to audit and route files carry business logic. | Move high-risk DB access behind service/repository helpers incrementally. |
| Tenant isolation is application-enforced only. | `packages/db/src/schema/*`, `packages/db/src/migrations/*` | A missed filter can leak data because there is no database policy backstop. | Evaluate PostgreSQL RLS or add targeted tenant-query audit tests. |
| Rate limiting is partly per-process. | `services/workspace/src/index.ts`, `services/agent/src/rate-limit.ts`, `packages/shared/src/rate-limit.ts` | Horizontal scaling weakens limits. | Require distributed store in production; fail closed or degrade explicitly. |
| Runtime and publish command surfaces remain broad. | `services/runtime/src/policy.ts`, `services/agent/src/tools/run_command.ts`, `services/publish/src/service.ts` | Approved shell commands and hosted start commands still carry escape/abuse risk. | Tighten command policy and add sandbox regression tests. |

### P1 Frontend And UX

| Finding | Evidence | Risk | Suggested slice |
| --- | --- | --- | --- |
| Global chat actions are wired through custom events with no reliable consumer and a possible toggle loop. | `apps/web/src/components/app-shell/main-canvas.tsx`, `apps/web/src/components/app-shell/keyboard-shortcut-provider.tsx` | Header, shortcuts, and command palette can fail or loop. | Wire shell actions directly to `ChatPanelProvider` state. |
| Settings contains no-op or static workflows. | `apps/web/src/app/(main)/settings/page.tsx` | Users can believe profile/model/storage/account actions worked when they did not. | Convert settings panels into real API-backed workflows with mobile tabs. |
| Automations has destructive actions without confirmation and no real run-history view. | `apps/web/src/app/(main)/automations/page.tsx`, `apps/web/src/components/automations/create-automation-dialog.tsx` | Users can delete automations accidentally and cannot inspect execution history. | Add confirm dialog, row pending state, inline validation, and real run history. |
| Hosting lacks detail/log/deploy diagnostics and silently ignores invalid env lines. | `apps/web/src/app/(main)/hosting/page.tsx` | Users cannot debug hosted services reliably. | Add service detail, logs/status history, and env validation feedback. |
| Admin pages can mask failed API calls as empty data. | `apps/web/src/app/(main)/admin/page.tsx` | Permission/service failures look like no data. | Add explicit error states and responsive table/card layouts. |
| Files page is weak on mobile/tablet because the tree is hidden below `lg`. | `apps/web/src/app/(main)/files/page.tsx`, `apps/web/src/components/workspace/editor.tsx` | Users can land in an editor with no visible file selection path. | Add mobile file picker/drawer flow. |
| Custom and hover-only controls carry accessibility risk. | `apps/web/src/components/ui/confirm-dialog.tsx`, `apps/web/src/components/chat/chat-core.tsx` | Keyboard and touch users can miss or fail controls. | Replace with accessible dialog primitives and visible/focusable actions. |

### P1 Infra, Tests, And Docs

| Finding | Evidence | Risk | Suggested slice |
| --- | --- | --- | --- |
| Environment setup is inconsistent between `infra/docker/.env` and root `.env`. | `README.md`, `scripts/setup.sh`, `packages/db/drizzle.config.ts`, `packages/db/src/client.ts` | Fresh setup can fail DB parsing unless env is exported manually. | Align setup script and DB config loading. |
| CI is too narrow for release confidence. | `.github/workflows/ci.yml`, `package.json` | Build, smoke, migrations, Docker, and e2e failures can escape CI. | Add staged CI jobs for build, smoke, and migration validation. |
| `smoke:local` omits browser service verification. | `scripts/baseline-smoke.mjs`, `package.json` | Browser regressions can pass the smoke gate. | Add browser typecheck/test to smoke. |
| Test/lint coverage has known holes. | `apps/web/package.json`, `packages/shared/package.json`, root `package.json` | Shared contracts and frontend workflows lack regression safety. | Add shared tests and frontend smoke/e2e coverage. |
| Deployment docs reference artifacts that do not exist. | `docs/PRODUCTION.md`, `infra/docker/docker-compose.yml` | Operators follow docs that cannot build/deploy the app. | Either add Dockerfiles/prod compose or rewrite docs to current reality. |
| Docs drift remains. | `docs/PROGRESS.md`, `docs/CLOUDMIND_OS_PRD_AND_TECHNICAL_SPEC.md`, service READMEs | Project status and service route/env names mislead future work. | Run a docs drift pass after CI/env cleanup. |
| Backup script bucket default can miss workspace objects. | `scripts/backup.sh`, `infra/docker/.env.example` | Backups may skip actual workspace object storage. | Align backup default with app bucket env. |

## Recommended First Implementation Slices

1. **Baseline Cleanup**
   - Install dependencies with `corepack pnpm install --frozen-lockfile`.
   - Align env setup and smoke command coverage.
   - Update stale docs that block reliable Superpowers execution.

2. **Auth And Error Contract Hardening**
   - Add typed domain errors.
   - Stop leaking internal 500 messages.
   - Normalize snapshot route auth.
   - Add route tests for runtime, publish, browser, datasets, and agent paths.

3. **Frontend Shell And Operations UX**
   - Fix chat shell action wiring.
   - Add real error states for admin/settings.
   - Harden automation delete/history and hosting diagnostics.
   - Add accessible dialog/action behavior.

4. **Release Confidence**
   - Add build and smoke to CI.
   - Add shared package tests.
   - Add frontend smoke/e2e coverage for login, chat, files, automations, hosting.
   - Reconcile production deployment docs with existing artifacts.

## Baseline Commands

Run these before claiming an implementation slice is complete:

```bash
git status --short --branch
corepack pnpm install --frozen-lockfile
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
corepack pnpm smoke:local
```

For infra-backed verification:

```bash
cp infra/docker/.env.example infra/docker/.env
set -a; source infra/docker/.env; set +a
corepack pnpm infra:up
corepack pnpm --filter @pcp/db migrate
corepack pnpm --filter @pcp/db seed
```

## Agent Prompt Template

```text
Read-only audit. Do not edit files.
Scope: <scope>.
Check against AGENTS.md rules: no cross-service DB access, tenant filters,
validated env, pino context, and no stale service assumptions.
Return: finding | evidence path | severity | risk | suggested verification |
suggested implementation slice.
```
