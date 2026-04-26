# Requirements: CloudMind OS

**Defined:** 2026-04-27
**Core Value:** Kullanıcı kendi izole cloud workspace'inde AI agent ile güvenli şekilde dosya okuma/yazma, komut çalıştırma ve otomasyon kurma yapabilmelidir.

## v1 Requirements

### Design System

- [ ] **DS-01**: Tailwind v4 + shadcn/ui component library entegre ve çalışır durumda
- [ ] **DS-02**: Dark mode ve light mode tam ve tutarlı çalışır
- [ ] **DS-03**: Inter fontu ve profesyonel renk paleti (koyu grafit + mavi/yeşil aksan) uygulanmış
- [ ] **DS-04**: Tüm temel UI componentleri hazır (Button, Modal, Toast, Tabs, Dropdown, DataTable, LoadingSkeleton, EmptyState, ErrorBoundary, ConfirmDialog, Tooltip, StatusBadge, CommandPalette)
- [ ] **DS-05**: Lucide icons tutarlı kullanılır
- [ ] **DS-06**: Her riskli aksiyonda confirmation modal gösterilir

### Layout

- [ ] **LAY-01**: Sol sabit sidebar (Home, Files, Chat, Automations, Hosting, Terminal, Snapshots, Settings)
- [ ] **LAY-02**: Üst bar (global search, command palette trigger, aktif model, notification icon, user menu)
- [ ] **LAY-03**: Desktop'ta split-view desteği (Files+Chat, Terminal+Logs yan yana)
- [ ] **LAY-04**: Mobilde sidebar drawer'a dönüşür
- [ ] **LAY-05**: Command palette Cmd/Ctrl+K ile açılır
- [ ] **LAY-06**: Keyboard shortcuts (Cmd+N new chat, Cmd+U upload)

### Auth & Onboarding

- [ ] **AUTH-01**: Login ekranı minimal ve profesyonel
- [ ] **AUTH-02**: Register ekranı hata mesajları net
- [ ] **AUTH-03**: İlk kayıt sonrası onboarding flow (workspace oluşturma, AI provider seçimi, örnek içerik)
- [ ] **AUTH-04**: "Mock AI ile devam et" seçeneği

### Dashboard

- [ ] **DASH-01**: Disk kullanımı kartı
- [ ] **DASH-02**: Aktif AI model kartı
- [ ] **DASH-03**: Son dosyalar listesi
- [ ] **DASH-04**: Son konuşmalar listesi
- [ ] **DASH-05**: Aktif otomasyonlar listesi
- [ ] **DASH-06**: Çalışan hosted servisler listesi
- [ ] **DASH-07**: Son bildirimler
- [ ] **DASH-08**: Hızlı aksiyonlar (New file, New chat, Upload, Create automation, Create site, Open terminal)

### File Manager

- [ ] **FILE-01**: Sol file tree + sağ dosya preview/editor layout
- [ ] **FILE-02**: Breadcrumb navigation
- [ ] **FILE-03**: Dosya arama (filename, content)
- [ ] **FILE-04**: Upload drag-drop
- [ ] **FILE-05**: Context menu (rename, move, copy, delete, download)
- [ ] **FILE-06**: Markdown preview, JSON formatter, CSV table preview
- [ ] **FILE-07**: Monaco code editor ile dosya düzenleme ve kaydetme
- [ ] **FILE-08**: Empty folder state anlamlı aksiyon butonlarıyla
- [ ] **FILE-09**: Çoklu seçim
- [ ] **FILE-10**: Dosya boyutu, tarih, mime type bilgisi gösterimi

### AI Chat

- [ ] **CHAT-01**: Conversation list (create/delete/rename)
- [ ] **CHAT-02**: Chat messages with streaming response
- [ ] **CHAT-03**: AI tool call kartları (hangi tool, parametreler, sonuç)
- [ ] **CHAT-04**: Tool call Approve/Reject UI (riskli işlemler için)
- [ ] **CHAT-05**: Model seçimi (per-conversation)
- [ ] **CHAT-06**: Stop/retry butonları
- [ ] **CHAT-07**: File mention desteği
- [ ] **CHAT-08**: Conversation title auto-generate

### Agent Tools

- [ ] **TOOL-01**: list_files, read_file, write_file, edit_file, delete_file, move_file, search_files, create_folder
- [ ] **TOOL-02**: run_command, get_terminal_history
- [ ] **TOOL-03**: create_automation, run_automation
- [ ] **TOOL-04**: create_site, start_service, stop_service
- [ ] **TOOL-05**: take_snapshot, restore_snapshot
- [ ] **TOOL-06**: Riskli tool'lar onay bekler (write/delete/command/hosting/snapshot restore)
- [ ] **TOOL-07**: Her tool call DB'ye kaydedilir

### Terminal

- [ ] **TERM-01**: xterm.js web terminal, workspace dizininde çalışır
- [ ] **TERM-02**: Canlı stdout/stderr stream
- [ ] **TERM-03**: Komut geçmişi paneli
- [ ] **TERM-04**: Birden çok terminal session desteği
- [ ] **TERM-05**: Bloklanan komutlar engellenir (rm -rf /, sudo, fork bomb, vb.)
- [ ] **TERM-06**: Riskli komutlarda onay modalı
- [ ] **TERM-07**: Command timeout ve resource limits

### Automations

- [ ] **AUTO-01**: Automation CRUD (title, prompt, schedule, model, enabled)
- [ ] **AUTO-02**: Schedule types: manual, hourly, daily, weekly, cron
- [ ] **AUTO-03**: Manual run butonu
- [ ] **AUTO-04**: Run history ve logs
- [ ] **AUTO-05**: Success/failure status ve retry
- [ ] **AUTO-06**: BullMQ ile background worker'da çalışır
- [ ] **AUTO-07**: Bildirim gönderimi (in-app, webhook)

### Hosting

- [ ] **HOST-01**: Service list ile status badge (running/stopped/error)
- [ ] **HOST-02**: Static site oluşturma
- [ ] **HOST-03**: Start/stop/restart butonları
- [ ] **HOST-04**: Logs paneli
- [ ] **HOST-05**: Env vars editor
- [ ] **HOST-06**: Preview iframe
- [ ] **HOST-07**: Port seçimi ve reverse proxy routing

### Snapshots

- [ ] **SNAP-01**: Snapshot create (workspace tar.gz)
- [ ] **SNAP-02**: Snapshot list (boyut, tarih, dosya sayısı)
- [ ] **SNAP-03**: Snapshot restore (öncesinde safety backup)
- [ ] **SNAP-04**: Snapshot delete
- [ ] **SNAP-05**: Restore öncesi uyarı modalı

### Settings

- [ ] **SET-01**: Profile sekmesi
- [ ] **SET-02**: AI Providers sekmesi (API key encrypted saklama, son 4 karakter gösterimi)
- [ ] **SET-03**: Models sekmesi (varsayılan model seçimi)
- [ ] **SET-04**: Workspace sekmesi (disk kullanımı)
- [ ] **SET-05**: Terminal Policy sekmesi (risk seviyesi ayarlama)
- [ ] **SET-06**: Theme sekmesi (dark/light)
- [ ] **SET-07**: Danger Zone (hesap silme)

### Admin

- [ ] **ADM-01**: Kullanıcı listesi
- [ ] **ADM-02**: Audit log görüntüleme
- [ ] **ADM-03**: Sistem health check
- [ ] **ADM-04**: Running services ve automation queue durumu

### Security

- [ ] **SEC-01**: Path traversal workspace dışına erişimi engeller
- [ ] **SEC-02**: API key AES-256-GCM ile encrypted saklanır
- [ ] **SEC-03**: Rate limiting
- [ ] **SEC-04**: Zod request validation
- [ ] **SEC-05**: Authorization middleware (tüm endpoint'lerde userId scope)
- [ ] **SEC-06**: Dosya upload size limit ve MIME validation
- [ ] **SEC-07**: Error mesajları secret göstermez

### Accessibility

- [ ] **A11Y-01**: Tüm butonlarda aria-label
- [ ] **A11Y-02**: Klavye navigasyonu
- [ ] **A11Y-03**: Focus ring ve modal focus trap
- [ ] **A11Y-04**: Kontrast oranı WCAG AA

### Testing

- [ ] **TEST-01**: Unit testler (path traversal, encryption, blocked commands, file CRUD, tool schema)
- [ ] **TEST-02**: Integration testler (auth flow, file ops, chat mock, tool calls, terminal, hosting, snapshots)
- [ ] **TEST-03**: Playwright E2E testler (kayıt, dosya, chat, terminal, otomasyon, snapshot, hosting)

### Infrastructure

- [ ] **INFRA-01**: Docker Compose ile tek komutta çalışır
- [ ] **INFRA-02**: .env.example ile konfigürasyon
- [ ] **INFRA-03**: README.md (kurulum, çalıştırma, testler, güvenlik modeli)
- [ ] **INFRA-04**: docs/PRODUCTION.md (deploy, HTTPS, scaling, monitoring)

## v2 Requirements

### Collaboration

- **COLLAB-01**: Multi-org / team workspaces
- **COLLAB-02**: Shared workspaces

### Integrations

- **INT-01**: Gmail gerçek entegrasyon (OAuth)
- **INT-02**: Google Drive import
- **INT-03**: Notion import/export
- **INT-04**: GitHub entegrasyonu

### Advanced

- **ADV-01**: MFA/TOTP
- **ADV-02**: Billing / subscription
- **ADV-03**: Custom domain SSL
- **ADV-04**: Firecracker microVM sandbox
- **ADV-05**: Marketplace

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time collaborative editing | Complexity çok yüksek, V2+ |
| Native mobile app | Web-first yaklaşım |
| Video/audio processing | Storage/bandwidth, farklı domain |
| Kubernetes orchestration | Docker Compose yeterli MVP için |
| Prisma migration | Mevcut Drizzle altyapısı çalışıyor, risk yüksek |
| Single API gateway rewrite | Microservice mimarisi korunacak |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DS-01..DS-06 | Phase 1 | Pending |
| LAY-01..LAY-06 | Phase 1 | Pending |
| AUTH-01..AUTH-04 | Phase 2 | Pending |
| DASH-01..DASH-08 | Phase 2 | Pending |
| FILE-01..FILE-10 | Phase 3 | Pending |
| CHAT-01..CHAT-08 | Phase 4 | Pending |
| TOOL-01..TOOL-07 | Phase 4 | Pending |
| TERM-01..TERM-07 | Phase 5 | Pending |
| AUTO-01..AUTO-07 | Phase 6 | Pending |
| HOST-01..HOST-07 | Phase 7 | Pending |
| SNAP-01..SNAP-05 | Phase 7 | Pending |
| SET-01..SET-07 | Phase 8 | Pending |
| ADM-01..ADM-04 | Phase 8 | Pending |
| SEC-01..SEC-07 | Phase 8 | Pending |
| A11Y-01..A11Y-04 | Phase 8 | Pending |
| TEST-01..TEST-03 | Phase 9 | Pending |
| INFRA-01..INFRA-04 | Phase 9 | Pending |

**Coverage:**
- v1 requirements: 86 total
- Mapped to phases: 86
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-27*
*Last updated: 2026-04-27 after initial definition*
