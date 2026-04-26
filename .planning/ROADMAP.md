# Roadmap: CloudMind OS

**Created:** 2026-04-27
**Milestone:** v1.0 — Production-Ready AI Cloud Computer
**Phases:** 9
**Granularity:** Standard

---

## Milestone 1: CloudMind OS v1.0

### Phase 1: Design System & App Shell

**Goal:** Profesyonel SaaS kalitesinde design system ve app shell layout kurulumu
**Requirements:** DS-01, DS-02, DS-03, DS-04, DS-05, DS-06, LAY-01, LAY-02, LAY-03, LAY-04, LAY-05, LAY-06
**Status:** Not Started
**Depends on:** —

**Success criteria:**
1. shadcn/ui tüm temel componentleri (Button, Modal, Toast, Tabs, Dropdown, etc.) çalışır
2. Dark/light mode toggle kusursuz çalışır, tüm componentlerde tutarlı
3. Sidebar + top bar + main content alanı responsive (desktop + mobile drawer)
4. Command palette Cmd/Ctrl+K ile açılır ve navigasyon çalışır
5. Split-view layout Files+Chat, Terminal+Logs gibi kombinasyonlarla çalışır

---

### Phase 2: Auth Polish & Dashboard

**Goal:** Login/register UX iyileştirme, onboarding flow ve zengin dashboard
**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07, DASH-08
**Status:** Not Started
**Depends on:** Phase 1

**Success criteria:**
1. Login/register ekranları profesyonel, hata mesajları net
2. İlk kayıt sonrası onboarding wizard çalışır (workspace, AI provider, örnek içerik)
3. Dashboard 8 kartın tamamını gerçek verilerle gösterir
4. Hızlı aksiyon butonları doğru sayfalara yönlendirir
5. Dashboard 2 saniye altında yüklenir

---

### Phase 3: File Manager

**Goal:** Tam özellikli dosya yöneticisi (tree, editor, preview, upload, context menu)
**Requirements:** FILE-01, FILE-02, FILE-03, FILE-04, FILE-05, FILE-06, FILE-07, FILE-08, FILE-09, FILE-10
**Status:** Not Started
**Depends on:** Phase 1

**Success criteria:**
1. File tree sol panelde, dosya içeriği sağ panelde gösterilir
2. Monaco editor ile dosya düzenleme ve Ctrl+S ile kaydetme çalışır
3. Drag-drop upload çalışır
4. Markdown preview, JSON formatter, CSV table doğru render edilir
5. Context menu (rename, move, copy, delete, download) çalışır

---

### Phase 4: AI Chat & Agent Tools

**Goal:** Tam özellikli chat UI + genişletilmiş agent tool seti + tool call onay sistemi
**Requirements:** CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06, CHAT-07, CHAT-08, TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05, TOOL-06, TOOL-07
**Status:** Not Started
**Depends on:** Phase 3

**Success criteria:**
1. Conversation list, create/delete/rename çalışır
2. Streaming response gerçek zamanlı görünür
3. AI tool call kartlarında tool adı, parametreler ve sonuç görünür
4. Riskli tool çağrılarında Approve/Reject UI çalışır ve onay bekler
5. 15+ agent tool (file ops, command, automation, hosting, snapshot) kayıtlı ve çalışır
6. Her tool call DB'ye kaydedilir

---

### Phase 5: Terminal

**Goal:** Web terminal (xterm.js) ile güvenli komut çalıştırma ve policy sistemi
**Requirements:** TERM-01, TERM-02, TERM-03, TERM-04, TERM-05, TERM-06, TERM-07
**Status:** Not Started
**Depends on:** Phase 1

**Success criteria:**
1. xterm.js terminali workspace dizininde başlar
2. Komut çıktısı real-time stream edilir
3. Birden çok terminal session açılabilir
4. Bloklanan komutlar (rm -rf /, sudo, fork bomb) çalışmaz
5. Riskli komutlarda onay modalı gösterilir
6. Command timeout 60s sonra process öldürülür

---

### Phase 6: Automations

**Goal:** AI otomasyon sistemi (CRUD, scheduling, BullMQ worker, run history)
**Requirements:** AUTO-01, AUTO-02, AUTO-03, AUTO-04, AUTO-05, AUTO-06, AUTO-07
**Status:** Not Started
**Depends on:** Phase 4

**Success criteria:**
1. Automation create/edit/delete/pause/resume çalışır
2. Schedule types (manual, hourly, daily, weekly, cron) ayarlanabilir
3. Manual run butonu otomasyonu anında çalıştırır
4. Run history ile success/failure durumu görünür
5. BullMQ worker otomasyon prompt'unu AI agent ile çalıştırır
6. Tamamlanan otomasyonlar bildirim gönderir (in-app + webhook)

---

### Phase 7: Hosting & Snapshots

**Goal:** Web site/servis hosting + workspace snapshot sistemi
**Requirements:** HOST-01, HOST-02, HOST-03, HOST-04, HOST-05, HOST-06, HOST-07, SNAP-01, SNAP-02, SNAP-03, SNAP-04, SNAP-05
**Status:** Not Started
**Depends on:** Phase 1

**Success criteria:**
1. Static site oluşturma ve preview iframe'de görüntüleme çalışır
2. Service start/stop/restart çalışır, status badge doğru
3. Env vars editor çalışır, logs paneli real-time
4. Snapshot create workspace'i tar.gz olarak saklar
5. Snapshot restore öncesi safety backup alınır, path traversal kontrolü yapılır
6. Restore uyarı modalı gösterilir

---

### Phase 8: Settings, Admin & Security Hardening

**Goal:** Tam settings ekranları, admin panel ve güvenlik sertleştirme
**Requirements:** SET-01..SET-07, ADM-01..ADM-04, SEC-01..SEC-07, A11Y-01..A11Y-04
**Status:** Not Started
**Depends on:** Phase 4

**Success criteria:**
1. Settings 7 sekmesi (Profile, AI Providers, Models, Workspace, Terminal Policy, Theme, Danger Zone) çalışır
2. API key encrypted saklanır (AES-256-GCM), UI'da son 4 karakter gösterilir
3. Admin panel kullanıcıları, audit logları, sistem health gösterir
4. Path traversal testleri geçer
5. Rate limiting ve Zod validation tüm endpoint'lerde aktif
6. Tüm butonlarda aria-label, modal focus trap, WCAG AA kontrast

---

### Phase 9: Testing, Docs & Docker Polish

**Goal:** Kapsamlı test suite, dokümantasyon ve Docker Compose tek komut kurulum
**Requirements:** TEST-01, TEST-02, TEST-03, INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Status:** Not Started
**Depends on:** Phase 8

**Success criteria:**
1. Unit testler geçer (path traversal, encryption, blocked commands, file CRUD, tool schema)
2. Integration testler geçer (auth, files, chat, tools, terminal, hosting, snapshots)
3. Playwright E2E testler geçer (kayıt → dosya → chat → terminal → otomasyon → snapshot → hosting)
4. `docker compose up --build` hatasız çalışır
5. README.md kurulum, çalıştırma, testler, güvenlik modeli, roadmap içerir
6. docs/PRODUCTION.md deploy, HTTPS, monitoring, scaling notları içerir

---

## Phase Dependency Graph

```
Phase 1 (Design System & Shell)
├── Phase 2 (Auth & Dashboard) → Phase 4 (Chat & Agent) → Phase 6 (Automations)
│                                        ↓
│                                  Phase 8 (Settings & Admin & Security)
│                                        ↓
│                                  Phase 9 (Testing & Docs)
├── Phase 3 (Files) → Phase 4
├── Phase 5 (Terminal)
└── Phase 7 (Hosting & Snapshots)
```

---
*Roadmap created: 2026-04-27*
*Last updated: 2026-04-27 after initial creation*
