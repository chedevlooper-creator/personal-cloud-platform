# Personal Cloud Workspace + AI Agent Platform — Build Plan

## 0. Amaç
Kullanıcıya kalıcı bir Linux benzeri workspace, dosya sistemi, terminal, kod çalıştırma, AI agent orkestrasyonu, üçüncü parti entegrasyonlar ve izole subdomain üzerinde uygulama yayınlama imkanı veren multi-tenant bir platform inşa etmek.

---

## 1. Hazırlık ve Temel Kurulum

### 1.1 Repo ve Workspace
- Monorepo oluştur (pnpm workspaces veya turborepo)
- Klasör yapısı:
  - `apps/web` (Next.js frontend)
  - `apps/api` (NestJS gateway)
  - `services/auth`
  - `services/workspace`
  - `services/runtime`
  - `services/agent`
  - `services/memory`
  - `services/publish`
  - `packages/shared` (types, schemas, utils)
  - `infra/` (docker-compose, traefik, migrations)
  - `.cursor/rules/` (Cursor rule dosyaları)

### 1.2 Geliştirme Ortamı
- Node.js 20+
- pnpm
- Docker + Docker Compose
- PostgreSQL 16 + pgvector extension
- Redis 7
- Traefik 3
- MinIO (S3-compatible local storage)

### 1.3 Cursor Rule Dosyaları
`.cursor/rules/` altında oluştur:
- `architecture.mdc`
- `backend-standards.mdc`
- `security.mdc`
- `database.mdc`
- `agents.mdc`
- `sandbox.mdc`
- `frontend.mdc`
- `testing.mdc`

---

## 2. Veritabanı Şeması

### 2.1 Temel Tablolar
- `users`
- `organizations`
- `memberships`
- `sessions`
- `oauth_accounts`
- `oauth_tokens` (encrypted)
- `audit_logs`
- `quotas`
- `usage_records`

### 2.2 Workspace Tabloları
- `workspaces`
- `workspace_files` (metadata)
- `workspace_volumes`

### 2.3 Runtime Tabloları
- `runtimes`
- `runtime_logs`
- `runtime_events`

### 2.4 Agent Tabloları
- `agent_tasks`
- `agent_task_steps`
- `tool_calls`
- `tool_registry`
- `tool_policies`

### 2.5 Memory Tabloları
- `memory_entries`
- `memory_embeddings` (pgvector)
- `memory_episodes`
- `memory_conflicts`

### 2.6 Publish Tabloları
- `published_apps`
- `app_deployments`
- `app_routes`

### 2.7 Migration Stratejisi
- Drizzle veya Prisma migration
- Her servis kendi migration namespace'ine sahip
- Seed scriptleri ayrı

---

## 3. Auth Servisi

### 3.1 Özellikler
- Email + password kayıt/giriş
- Argon2id password hashing
- OIDC + OAuth 2.1 entegrasyonu
- PKCE desteği
- Refresh token rotation
- Session yönetimi (HTTP-only cookie)
- MFA (TOTP) opsiyonel

### 3.2 Güvenlik
- Rate limiting (IP + account)
- CSRF protection
- User enumeration koruması
- SameSite=Lax cookie
- Origin header validation

### 3.3 API Endpoints
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`
- `GET /auth/me`
- `GET /auth/oauth/:provider/start`
- `GET /auth/oauth/:provider/callback`

### 3.4 Test Kapsamı
- Unit: hashing, token generation
- Integration: full login flow
- Security: brute force, CSRF, token reuse

---

## 4. Workspace Servisi

### 4.1 Özellikler
- Kullanıcı başına persistent workspace
- Dosya sistemi API (list, read, write, delete, move)
- Dizin oluşturma
- Dosya upload/download
- Workspace quota enforcement
- Soft delete + version history (opsiyonel)

### 4.2 Storage Stratejisi
- Metadata: PostgreSQL
- Dosya içeriği: MinIO/S3
- Workspace volume: Docker named volume veya host bind
- Tenant izolasyonu: prefix-based bucket veya ayrı bucket

### 4.3 API Endpoints
- `GET /workspaces/:id/files`
- `GET /workspaces/:id/files/*path`
- `PUT /workspaces/:id/files/*path`
- `DELETE /workspaces/:id/files/*path`
- `POST /workspaces/:id/files/move`

### 4.4 Güvenlik
- Path traversal koruması
- MIME type validation
- Size limit
- Tenant scope check

---

## 5. Runtime Servisi (Sandbox)

### 5.1 MVP — Docker tabanlı
- Read-only base image
- Writable workspace volume mount
- Non-root user execution
- seccomp + apparmor profile
- Network egress disabled by default
- CPU, memory, disk, timeout limitleri
- cgroups ile resource control

### 5.2 Runtime Lifecycle
- `create` → container provision
- `start` → execution başlat
- `exec` → komut çalıştır
- `stop` → graceful shutdown
- `destroy` → cleanup

### 5.3 Terminal ve Shell
- WebSocket tabanlı terminal
- PTY allocation
- Komut allow/deny listesi
- Session recording (audit)

### 5.4 API Endpoints
- `POST /runtimes`
- `POST /runtimes/:id/start`
- `POST /runtimes/:id/exec`
- `POST /runtimes/:id/stop`
- `DELETE /runtimes/:id`
- `WS /runtimes/:id/terminal`

### 5.5 Abstraction Layer
- `RuntimeProvider` interface
- DockerProvider (MVP)
- FirecrackerProvider (V2)
- KataProvider (V2)

### 5.6 Güvenlik
- Komut filtreleme (rm -rf /, fork bomb vb.)
- Network policy
- Secret injection sadece runtime içinde
- Log/audit her exec için

---

## 6. Agent Orchestration Servisi

### 6.1 Mimari Katmanlar
- Tool Definition Layer
- Tool Registry
- Tool Execution Layer
- Agent Orchestrator
- Observability Layer

### 6.2 Tool Calling Standardı
- MCP uyumlu tool interface
- Tool tanımı: name, description, input schema (Zod), auth, risk level, timeout
- Tool result normalization

### 6.3 Agent Loop
- ReAct pattern (küçük tasklar)
- Plan-and-Execute pattern (büyük tasklar)
- Continuous loop: Thought → Action → Observation
- Max iteration limit
- Cancel/resume/retry desteği

### 6.4 Provider Abstraction
- `LLMProvider` interface
- OpenAI adapter
- Anthropic adapter
- Google adapter
- Streaming support

### 6.5 Task State Machine
- `pending`
- `planning`
- `executing`
- `waiting_approval`
- `completed`
- `failed`
- `cancelled`

### 6.6 Tool Execution Policy
- Allow/deny per tool
- Approval gerektiren toollar
- Tenant scope check
- Rate limit per tool
- Audit log her çağrı için

### 6.7 API Endpoints
- `POST /agent/tasks`
- `GET /agent/tasks/:id`
- `POST /agent/tasks/:id/cancel`
- `POST /agent/tasks/:id/approve`
- `GET /agent/tasks/:id/steps`
- `GET /agent/tools`

### 6.8 Test Kapsamı
- Tool calling unit tests
- Loop termination tests
- Retry/cancel scenarios
- Policy enforcement tests

---

## 7. Memory Servisi

### 7.1 Memory Türleri
- Working memory (session context)
- Short-term memory (recent interactions)
- Long-term semantic memory (pgvector)
- Episodic memory (event history)
- Procedural memory (V2)

### 7.2 Memory Operations
- `add` — yeni memory ekle
- `search` — semantic + keyword hybrid
- `update` — mevcut memory güncelle
- `delete` — memory sil
- `consolidate` — short → long term
- `resolve_conflict` — çelişen memory yönetimi

### 7.3 Embedding Stratejisi
- OpenAI text-embedding-3-small veya benzeri
- Chunk size: 512 token
- Overlap: 50 token
- Tenant + user scope

### 7.4 Retrieval Pipeline
- Query → embedding
- Vector search (top-k)
- Reranking
- Context assembly
- Token budget enforcement

### 7.5 API Endpoints
- `POST /memory/entries`
- `POST /memory/search`
- `PATCH /memory/entries/:id`
- `DELETE /memory/entries/:id`

### 7.6 Conflict Resolution
- Timestamp-based superseding
- LLM-based merge
- Versioning

---

## 8. Publish Servisi

### 8.1 Özellikler
- Kullanıcı app'ini build et
- Subdomain assign et
- TLS otomatik (Let's Encrypt)
- Deployment lifecycle
- Rollback desteği

### 8.2 Routing
- Wildcard DNS (`*.apps.platform.com`)
- Traefik dynamic config
- Per-app container veya shared runtime
- Health check

### 8.3 Build Pipeline
- Static site (HTML/JS)
- Node.js runtime
- Python runtime (V2)
- Build cache

### 8.4 API Endpoints
- `POST /publish/apps`
- `POST /publish/apps/:id/deploy`
- `GET /publish/apps/:id/deployments`
- `POST /publish/apps/:id/rollback`
- `DELETE /publish/apps/:id`

### 8.5 Güvenlik
- Per-app sandbox
- Resource limit
- Subdomain takeover koruması
- Rate limiting

---

## 9. Frontend (Next.js)

### 9.1 Sayfalar
- Login / Register
- Dashboard
- Workspace explorer (file tree)
- Terminal (xterm.js)
- Code editor (Monaco)
- Agent chat interface
- Agent task viewer
- Settings (OAuth integrations)
- Published apps yönetimi

### 9.2 State Management
- TanStack Query
- Zustand (UI state)

### 9.3 Realtime
- WebSocket bağlantısı
- SSE for agent task updates
- Terminal stream

### 9.4 UI Component'ler
- Tailwind + shadcn/ui
- File tree component
- Terminal component
- Chat component
- Task timeline component

---

## 10. Observability

### 10.1 Logging
- Structured JSON logs (pino)
- Correlation ID her request için
- Tenant + user context

### 10.2 Metrics
- Prometheus exporter
- Per-service metrics
- Token usage tracking
- Tool call latency

### 10.3 Tracing
- OpenTelemetry
- Agent loop traces
- Tool call spans

### 10.4 Audit
- Auth events
- Runtime exec events
- Tool calls
- File operations
- Admin actions

---

## 11. Güvenlik Hardening

### 11.1 Network
- Default deny egress (sandbox)
- Internal service mesh
- TLS everywhere

### 11.2 Secrets
- Vault veya AWS Secrets Manager
- Encryption at rest
- Key rotation

### 11.3 Sandbox
- microVM (Firecracker/Kata) V2
- seccomp profiles
- apparmor profiles
- Read-only rootfs

### 11.4 Policy Engine
- Tool execution policies
- Workspace access policies
- Quota enforcement
- Rate limiting

---

## 12. Geliştirme Sırası (Faz Faz)

### Faz 1 — Foundation (1-2 hafta)
- Monorepo setup
- DB schema + migrations
- Auth service
- Basic frontend (login, register)

### Faz 2 — Workspace (1-2 hafta)
- Workspace service
- File API
- Frontend file explorer

### Faz 3 — Runtime (2-3 hafta)
- Docker-based runtime
- Terminal
- Code execution
- Frontend terminal + editor

### Faz 4 — Agent Core (2-3 hafta)
- Tool registry
- Agent orchestrator
- Basic tool calling
- Frontend chat interface

### Faz 5 — Memory (1-2 hafta)
- Memory service
- Embedding pipeline
- Retrieval
- Agent context integration

### Faz 6 — Publish (1-2 hafta)
- Publish service
- Traefik integration
- Subdomain routing

### Faz 7 — Hardening (2-3 hafta)
- Observability
- Security audit
- Rate limiting
- Quota enforcement
- microVM migration planı

---

## 13. Cursor Çalışma Akışı

### 13.1 Her Modül İçin
1. Master spec'i bağla (`@architecture.mdc`)
2. İlgili modül rule'unu bağla (örn. `@agents.mdc`)
3. Cursor'a sırasıyla iste:
   - Design summary
   - Folder/file plan
   - DB schema değişiklikleri
   - API contracts (OpenAPI)
   - Implementation
   - Tests
   - Security notes
   - Open decisions (DECISIONS.md'ye ekle)

### 13.2 Doğru Prompt Şablonu
```
Implement the [MODULE_NAME] module.

Context: @architecture.mdc @[module].mdc @database.mdc @security.mdc

Requirements:

[list]

Return:
1. Design summary
2. File structure
3. DB migrations
4. API contracts
5. Service code
6. Tests
7. Security checklist
8. Open decisions
```

### 13.3 Kaçınılması Gerekenler
- Tek seferde "tüm projeyi yap" prompt'u
- Belirsiz gereksinimler
- Test yazmadan ilerlemek
- Security checklist atlamak
- Decision'ları belgelememek

---

## 14. Test Stratejisi

### 14.1 Test Türleri
- Unit (her servis)
- Integration (DB + service)
- E2E (full user flow)
- Security (auth, sandbox escape)
- Load (runtime, agent)

### 14.2 Test Araçları
- Vitest (unit)
- Playwright (E2E)
- k6 (load)

### 14.3 CI/CD
- GitHub Actions
- Lint + test on PR
- Migration check
- Security scan (Snyk/Trivy)
- Docker image build

---

## 15. Açık Kararlar (DECISIONS.md)

Her aşamada karar verilmesi gereken konular:
- Sandbox: Docker vs Firecracker geçiş zamanı
- Memory: pgvector vs Qdrant
- Workflow durability: kendi yazma vs Temporal
- Auth: kendi OIDC vs Auth0/Clerk
- Storage: MinIO vs direct S3
- Frontend framework: Next.js vs Remix
- Real-time: WebSocket vs SSE
- Tool standardı: pure MCP vs hybrid

---

## 16. MVP Tanımı

### MVP'de olacaklar
- Auth (email + OAuth)
- Workspace + file API
- Docker-based runtime + terminal
- Basic agent + 5-10 built-in tool
- Semantic memory
- Frontend: login, workspace, terminal, agent chat

### MVP'de olmayacaklar
- microVM
- Publish service
- MFA
- Multi-org
- Marketplace
- Billing

---

## 17. Sonraki Adım

İlk olarak şunu yap:
1. Bu dosyayı `BUILD_PLAN.md` olarak repo root'a koy
2. `.cursor/rules/architecture.mdc` dosyasını oluştur
3. `infra/docker-compose.yml` ile Postgres + Redis + MinIO + Traefik ayağa kaldır
4. Drizzle/Prisma schema'yı yaz
5. Auth servisinden başla