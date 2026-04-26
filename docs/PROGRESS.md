# Project Progress

Updated weekly. Each phase tracked here.

---

## Current Phase: Faz 0 — Foundation

**Status:** In progress  
**Started:** 2026-04-26  
**Target:** 2026-04-29

### Checklist
- [x] Monorepo created
- [x] pnpm workspace configured
- [x] Folder structure created
- [x] Docker compose written
- [x] Docker compose ayağa kalktı
- [x] PostgreSQL bağlantı doğrulandı
- [x] Cursor rules yazıldı
- [x] packages/db Drizzle setup
- [x] packages/shared setup
- [x] packages/logger setup
- [x] README yazıldı
- [x] BUILD_PLAN.md eklendi
- [x] İlk commit pushlandı

---

## Upcoming

### Faz 1 — Auth Service
**Target:** 1-2 hafta
- [x] Schema + migrations
- [x] Password auth
- [x] Session management
- [x] Rate limiting
- [x] Audit logging
- [x] Google OAuth
- [x] Refresh tokens
- [x] Tests

### Faz 2 — Workspace Service
**Target:** 1-2 hafta
- [x] Schema + migrations (workspaces, workspace_files)
- [x] Create/list workspace API
- [x] File system API (list, read, write, delete, move)
- [x] Directory creation
- [x] Storage quota enforcement
- [x] Soft delete
- [x] Tests

### Faz 3 — Runtime Service
**Target:** 2-3 hafta
- [x] Schema + migrations (runtimes, logs, events)
- [x] RuntimeProvider abstraction
- [x] DockerProvider implementation
- [x] Lifecycle API (create, start, stop, exec, delete)
- [x] WebSocket Terminal support
- [x] Resource limits (CPU, Memory)
- [x] Network isolation (NetworkMode: none)

### Faz 4 — Agent Service
**Target:** 2-3 hafta
- [x] Schema + migrations (tasks, task_steps)
- [x] Tool Definition Layer & Registry
- [x] LLM Provider adapters (OpenAI, Anthropic)
- [x] Agent Orchestrator (Thought-Action-Observation loop)
- [x] Task state machine & execution policies
- [x] Orchestration API endpoints (create, get, steps, cancel)
- [x] Basic tests

### Faz 5 — Memory Service
**Target:** 1-2 hafta
- [x] Schema + migrations (memory_entries, pgvector setup)
- [x] EmbeddingProvider abstraction (OpenAI embeddings)
- [x] Memory Service (add, update, delete, semantic search)
- [x] API Endpoints (POST /memory/entries, POST /memory/search, vb.)
- [x] Tests & Build verification

### Faz 6 — Publish Service
### Faz 7 — Hardening

---

## Metrics

- Total LOC: 0
- Test coverage: 0%
- Open ADRs: 5
- Pending decisions: 5