# PROJECT.md — CloudMind OS

> Personal AI cloud computer platform. Multi-tenant, browser-based.
> **State:** Brownfield. 7 services + Next.js frontend exist; production-readiness gaps remain.

## What This Is

A multi-tenant AI cloud OS where each user gets:

- A persistent **workspace** with files (Monaco editor + S3 storage)
- A **terminal** (xterm.js + WebSocket PTY, sandboxed)
- An **AI agent** with tool calls, memory, MCP, and BYOK LLMs
- **Automations** (BullMQ scheduled tasks)
- **Hosting** (deploy static / Vite / Node apps via Docker + Traefik)
- **Snapshots** (workspace tar.gz to MinIO)
- **Browser sessions** (cloud Playwright per user)
- **Channels** (Telegram bot adapter)
- **Admin / audit log / settings**

Frontend is Next.js 16 + React 19 (Turkish UI). Backend is **7 independent Fastify v4 microservices** glued by Postgres (pgvector), Redis (BullMQ), MinIO, and Traefik. The README's claim of an `apps/api` at :4000 is stale — disregard it.

## Core Value

**One sentence:** A personal AI workstation that's safe to give a user — they can run code, host apps, schedule tasks, and use AI tools without leaking into other tenants or escaping the sandbox.

The ONE thing that must work: **multi-tenant isolation + a usable AI agent + reliable workspace persistence**. Everything else is supporting cast.

## Context

- **Stage:** Late alpha. All major modules exist (auth, workspace, runtime, agent, memory, publish, browser, 24 frontend pages). Recent work bridges Supabase auth into the existing schema.
- **Recent audit:** `docs/superpowers/reports/2026-05-02-cloudmind-superpowers-gap-audit.md` enumerates P1 gaps blocking production. This roadmap is built on that audit + a graphify codebase scan.
- **Team size:** Inferred small (1–2 contributors based on recent git activity).
- **Constraints:**
  - Stay on Docker Compose (no Kubernetes yet)
  - pnpm workspace (no migration to Turborepo or Nx in scope)
  - Vitest version split (auth/workspace v4, others v1) is **intentional** — do not unify
  - `@pcp/shared` has no build step — consumers import from `src/`
  - UI text is Turkish

## Requirements

### Validated (existing — confirmed by codebase + smoke pass)

- ✓ Email/password auth + Google OAuth + session cookies — `services/auth`
- ✓ Multi-tenant DB schema (24 tables, all tenant-scoped) — `packages/db/src/schema/*`
- ✓ Workspace files: tree, Monaco editor, drag-drop upload — `services/workspace`, `apps/web/src/app/(main)/files`
- ✓ Snapshots: tar.gz workspace backup to MinIO with restore — `services/workspace/src/routes/snapshots.ts`
- ✓ AI chat with streaming, tool-call approval UI, BYOK providers — `services/agent`, `apps/web/.../chats`
- ✓ Web terminal: xterm.js + WebSocket PTY with strict/balanced/permissive policy — `services/runtime`, `services/agent/src/tools/run_command.ts`
- ✓ Automations: BullMQ-scheduled AI tasks (manual/hourly/daily/weekly/cron) — `services/agent/src/automation`
- ✓ Hosting: Docker + Traefik for static/Vite/Node — `services/publish`
- ✓ Datasets: DuckDB-backed CSV/JSON/Parquet read-only SQL — `services/workspace/src/routes/datasets.ts`
- ✓ Cloud Playwright browser sessions per user — `services/browser`
- ✓ Telegram channel adapter — `services/agent/src/channels`
- ✓ AES-256-GCM encrypted API key storage — `services/auth`
- ✓ Per-user audit log with retention pruner — `services/auth/src/routes/admin.ts`, `audit_logs` table
- ✓ Admin page (user list, audit logs, system health) — `apps/web/src/app/(main)/admin`
- ✓ Custom seccomp profile for runtime sandboxing — `infra/docker/seccomp-runtime.json`
- ✓ pino structured logs with `correlationId, userId, service`
- ✓ CI: typecheck → lint → test on push
- ✓ Idempotent DB seed (Sandbox workspace, skills, datasets, hosted services)
- ✓ Master design system token-driven UI — `design-system/MASTER.md`

### Active (production-readiness gaps from audit)

- [ ] **SEC-01** Typed domain errors mapped to HTTP envelopes (no plain `Error` → 500)
- [ ] **SEC-02** Route catches don't leak driver/upstream details
- [ ] **SEC-03** Internal service token has audience/service scoping (no broad impersonation)
- [ ] **SEC-04** Workspace routes use central auth helper consistently
- [ ] **SEC-05** Routes never do direct DB work — repository layer enforced
- [ ] **SEC-06** Tenant isolation has DB-level backstop (RLS or audit tests)
- [ ] **SEC-07** Distributed rate limiting that survives horizontal scale
- [ ] **SEC-08** Runtime/publish command policy tightened with sandbox regression tests
- [ ] **UX-01** Chat shell actions wired to provider state (no DOM-event toggle loops)
- [ ] **UX-02** Settings panels are real API-backed forms with mobile layout
- [ ] **UX-03** Automations: confirm dialogs + real run history view
- [ ] **UX-04** Hosting: service detail / logs / env validation
- [ ] **UX-05** Admin pages show explicit error states; responsive layouts
- [ ] **UX-06** Files page works on mobile/tablet
- [ ] **UX-07** All custom controls accessible (keyboard + touch)
- [ ] **INF-01** README rewritten to match current architecture
- [ ] **INF-02** Frontend smoke tests via Playwright (top-3 flows)
- [ ] **INF-03** `normalizeProfileValue` consolidated to `@pcp/shared`

### Out of Scope

- Multi-region deployment — single-region is sufficient for current users
- SSO (SAML / Okta) — BYOK + email/password covers personas
- Native mobile apps — responsive web only
- Kubernetes migration — Docker Compose handles current scale
- Unifying vitest versions — intentional split (see AGENTS.md)
- New product modules (no scope creep — finish what exists first)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Brownfield init from existing code + gap audit | Project already alpha; no need for greenfield research | — Pending |
| Skip 4 parallel research subagents | Gap audit + graphify already provide domain evidence; saves tokens | — Pending |
| Source roadmap from `2026-05-02-cloudmind-superpowers-gap-audit.md` P1 findings | Team has already triaged; align with their judgment | — Pending |
| Coarse granularity (3 P1 themes → ~7 phases) | Audit groups naturally; finer slicing creates noise | — Pending |
| Postgres RLS evaluation, not mandate | RLS may be too costly for the size of the team; audit tests are a fallback | — Pending |
| Vitest version split preserved | API differences make unification unsafe | — Validated by AGENTS.md |
| `@pcp/shared` stays buildless | Adding `dist/` would break consumers' `src/` imports | — Validated by AGENTS.md |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-06 after initialization (brownfield, audit-derived)*
