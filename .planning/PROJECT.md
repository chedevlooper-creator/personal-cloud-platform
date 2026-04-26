# CloudMind OS

## What This Is

CloudMind OS, kullanıcının tarayıcıdan eriştiği kişisel AI bulut bilgisayarıdır. Her kullanıcının izole workspace'i, dosya yöneticisi, AI agent sohbeti, terminal, otomasyon sistemi, hosting ve snapshot özellikleri vardır. Profesyonel SaaS kalitesinde, üretkenlik odaklı bir "AI cloud computer OS" arayüzü sunar.

## Core Value

Kullanıcı kendi izole cloud workspace'inde AI agent ile güvenli şekilde dosya okuma/yazma, komut çalıştırma ve otomasyon kurma yapabilmelidir.

## Requirements

### Validated

<!-- Mevcut codebase'de çalışan özellikler -->

- ✓ Email/password ile kayıt ve giriş — existing (auth service)
- ✓ Argon2 password hashing — existing (auth service)
- ✓ Session-based auth (HTTP-only cookie) — existing (auth service)
- ✓ OAuth2 hesap bağlama — existing (auth service)
- ✓ Audit logging — existing (auth service)
- ✓ Workspace CRUD — existing (workspace service)
- ✓ Dosya listeleme ve CRUD — existing (workspace service)
- ✓ MinIO/S3 dosya storage — existing (workspace service)
- ✓ Storage quota tracking — existing (workspace service)
- ✓ Docker container lifecycle (create/start/stop/exec/destroy) — existing (runtime service)
- ✓ Agent task create/cancel/get — existing (agent service)
- ✓ LLM provider abstraction (OpenAI, Anthropic, MiniMax) — existing (agent service)
- ✓ Agent tool registry + ReadFile tool — existing (agent service)
- ✓ Agent loop (ReAct pattern, max 15 iterations) — existing (agent service)
- ✓ Semantic memory add/search/update/delete (pgvector) — existing (memory service)
- ✓ App publish + deploy (nginx containers with Traefik labels) — existing (publish service)
- ✓ PostgreSQL + pgvector DB — existing (infra)
- ✓ Redis — existing (infra, not yet integrated in services)
- ✓ MinIO — existing (infra)
- ✓ Traefik reverse proxy — existing (infra)
- ✓ Drizzle ORM schema (22 tables) — existing (packages/db)
- ✓ Shared DTOs with Zod — existing (packages/shared)
- ✓ Next.js frontend with sidebar navigation — existing (apps/web)

### Active

<!-- Bu milestone'da inşa edilecek özellikler -->

- [ ] Profesyonel SaaS kalitesinde UI/UX overhaul
- [ ] Design system (shadcn/ui + Tailwind v4 + Lucide)
- [ ] Dark/light mode tam destek
- [ ] Responsive layout (desktop split-view + mobile drawer)
- [ ] Command palette (Cmd+K)
- [ ] Onboarding flow
- [ ] Home dashboard (disk, model, son dosyalar, konuşmalar, otomasyonlar)
- [ ] Gelişmiş dosya yöneticisi (search, preview, drag-drop upload, context menu)
- [ ] Monaco code editor entegrasyonu
- [ ] AI chat UI (conversation list, streaming, tool call cards, approve/reject)
- [ ] Genişletilmiş agent tool seti (15+ tool)
- [ ] Tool call onay sistemi (riskli işlemler için approve/reject)
- [ ] Web terminal (xterm.js, komut policy, blocked commands)
- [ ] Automations sistemi (CRUD, schedule, BullMQ worker)
- [ ] Hosting modülü (static/Node servis, start/stop/restart, logs, env vars, preview)
- [ ] Snapshot sistemi (create/restore/delete, tar.gz, safety backup)
- [ ] Settings ekranları (profile, AI providers, models, workspace, theme, danger zone)
- [ ] Admin paneli (kullanıcılar, audit logs, sistem health)
- [ ] API key encrypted saklama (AES-256-GCM)
- [ ] Bildirim merkezi
- [ ] Keyboard shortcuts
- [ ] Accessibility (aria-label, focus trap, kontrast)
- [ ] Playwright E2E testler
- [ ] Docker Compose ile tek komutta çalıştırma

### Out of Scope

- Real-time collaborative editing — Complexity, V2+
- Mobile native app — Web-first, V2+
- Billing / subscription — V2+
- Custom domain SSL (production) — Local MVP'de disabled
- OAuth provider login (Google/GitHub button) — Mevcut altyapı var ama UI yok, V2
- Firecracker/Kata microVM — V2+ (Docker yeterli)
- Real integrations (Gmail, Notion, Drive) — Mock + webhook only for V1
- Multi-org / team workspaces — V2+
- Marketplace — V2+

## Context

Mevcut codebase bir pnpm monorepo: 6 Fastify microservice + Next.js 16 frontend + Drizzle ORM + Docker altyapısı. Temel servisler (auth, workspace, runtime, agent, memory, publish) çalışır durumda ama çoğu UI ekranı placeholder seviyesinde. Bu milestone'da tüm servisleri production-ready UI ile buluşturup, eksik özellikleri (automations, snapshots, terminal, onboarding) ekleyeceğiz.

Mevcut stack korunacak — Drizzle ORM, Fastify microservices, pnpm workspace. Prisma'ya geçiş yapılmayacak (mevcut 22 tablo migration'ı riskli). Tek API gateway yerine mevcut microservice mimarisi devam edecek.

## Constraints

- **Tech Stack**: Mevcut Drizzle + Fastify + Next.js 16 korunacak — migration riski yüksek
- **Infra**: Docker Compose tek komutta çalışmalı
- **Security**: Path traversal, workspace isolation, API key encryption zorunlu
- **AI Provider**: API key yoksa mock provider ile çalışmalı
- **Browser**: Modern browsers (Chrome 90+, Firefox 90+, Safari 15+)
- **Performance**: Dashboard 2s altında yüklenmeli

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Drizzle ORM'de kal, Prisma'ya geçme | 22 tablo migration'ı riskli, mevcut altyapı çalışıyor | — Pending |
| Microservice mimarisi koru | Mevcut servisler çalışıyor, refactor gereksiz risk | — Pending |
| shadcn/ui + Tailwind v4 | Zaten kurulu, component library hazır | — Pending |
| xterm.js terminal | Zaten dependency olarak var, gerçek terminal hissi | — Pending |
| BullMQ automation worker | Redis zaten infra'da, BullMQ production-ready | — Pending |
| AES-256-GCM API key encryption | Industry standard, Node.js native crypto | — Pending |
| tar.gz snapshot format | Basit, hızlı, platform bağımsız | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-27 after initialization*
