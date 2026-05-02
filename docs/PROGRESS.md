# Project Status

Snapshot of where the platform is right now. Replaces the old "Faz 0–7" tracker.

---

## Shipped (working end-to-end)

### Foundation
- pnpm workspace, Node 20+, strict TS (`noUncheckedIndexedAccess`).
- Docker Compose stack: Postgres 16 (pgvector), Redis 7, MinIO, Traefik 3, Mailhog.
- `@pcp/db` (Drizzle ORM) is the sole schema/migration owner.
- `@pcp/shared` ships Zod DTOs from `src/` (no build step).

### Services (all 7 running)
| Port | Service     | Status | Notes |
| ---- | ----------- | ------ | ----- |
| 3001 | auth        | ✅     | Argon2id, sessions, Google OAuth, audit log, AES-256-GCM provider keys |
| 3002 | workspace   | ✅     | S3 file CRUD, snapshots, datasets (DuckDB), auto-provisioning |
| 3003 | runtime     | ✅     | Docker provider, PTY WebSocket, resource limits |
| 3004 | agent       | ✅     | Tool registry, ReAct loop, BullMQ automations, personas, skills |
| 3005 | memory      | ✅     | pgvector, OpenAI embeddings or local hash fallback |
| 3006 | publish     | ✅     | Docker-hosted apps + Traefik routing, encrypted env vars |
| 3007 | browser     | ✅     | Cloud Playwright sessions, agent tool integration |

### Frontend (`apps/web`)
- Next.js 16 + React 19, Tailwind v4, shadcn/ui, TanStack Query, Zustand.
- Authenticated app shell with: Dashboard, Files (Monaco), Terminal (xterm), Chat,
  Skills, Personas, Automations, Hosting, Snapshots, Datasets, Browser, Settings, Admin.
- Persona + Skill + Rules selectors wired into chat (sent on every task).
- LLM defaults to MiniMax M2.7 via Anthropic-compatible endpoint.

### Personalization & integration (latest)
- Skills/Personas/Rules fetched once per session, persisted client-side, injected into the
  agent system prompt server-side (`buildSystemPrompt`).
- `provider_credentials` (BYOK) is now read by the agent at task start; the user's saved
  provider + model overrides the service default.
- `user_preferences.defaultProvider` / `defaultModel` flow into the LLM call.

---

## Open work (not yet done)

### Production blockers
- 32-byte random `ENCRYPTION_KEY` (current dev value is rejected by the prod guard) and
  re-encrypt existing `provider_credentials` rows.
- Centralized auth middleware package — every service still re-implements cookie/session
  reads against the DB.
- Global API error envelope + Fastify `errorHandler`. Many routes still return ad-hoc
  `{ error: string } as any`.
- Tighter Zod env validation across services (some still rely on `process.env` fallbacks).
- Finish removing `as any` casts around Fastify + Zod wildcard (`*path`) routes.

### Sandbox / runtime
- Seccomp + AppArmor profiles, read-only rootfs, network egress allow-list.
- CPU/RAM/wall-clock limits surfaced and enforced for `run_command` tool calls.
- Plan to swap Docker for Firecracker/Kata in a follow-up.

### Agent
- Streaming responses (currently single-shot).
- Token / cost telemetry stored on `task_steps`.
- Required-approval gating for high-risk tools (run_command, browser fill).
- Retrieval reranking on top of pgvector HNSW (added in migration `0010`).

### Observability
- `correlationId` + `userId` consistently attached to every pino log.
- `/metrics` Prometheus endpoint per service.
- OpenTelemetry traces across the agent loop.

### Test & CI
- CI exists for install, typecheck, lint, and tests; build, smoke, e2e, deploy, and release gates
  still need coverage.
- Vitest version split (`auth`/`workspace` on 4.x, others on 1.x) — unify after Faz 7.
- `apps/web` and `packages/shared` have no tests.

### Frontend polish
- WebSocket/SSE streaming for chat instead of 1–2 s polling.
- Optimistic mutations + invalidation tightening.
- Accessibility pass (focus traps, contrast, dialog wiring).
- i18n (UI is mixed TR/EN today).

---

## Where to look next

- Architecture overview: `README.md`
- Production checklist & scaling notes: `docs/PRODUCTION.md`
- Architectural decisions: `docs/DECISIONS.md`
- Per-service notes: `services/<svc>/README.md`
- Agent guidance: `AGENTS.md`, `CLAUDE.md`
