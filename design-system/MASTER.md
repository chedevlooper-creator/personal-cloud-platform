# Zihinbulut · Master Design System

> Tek doğruluk kaynağı (single source of truth). Bu dosya stack içinde **çalıştırılabilir** olanı (CSS değişkenleri, shadcn componentleri, Tailwind v4 `@theme inline` blokları) **belgeler ve genişletir** — yeniden tanımlamaz.
>
> **Kod doğrudan kazanır:** `apps/web/src/app/globals.css` ile bu dosya çelişirse, globals.css doğrudur ve buradaki bölüm güncellenir.

---

## 1 · Ürün Kimliği

| Alan | Değer |
| --- | --- |
| **Ürün** | Zihinbulut (CloudMind OS) — kişisel AI bulut bilgisayar |
| **Vaat** | "Tarayıcıda açılan, kalıcı, izole, AI’ın kontrol ettiği bir çalışma alanı." |
| **Ses tonu** | Sakin · profesyonel · Türkçe arayüz · jargon yok |
| **Birincil kullanıcı** | Tek kişi / küçük takım, geliştirici-tüketici karışımı |
| **Yoğun ekranlar** | Sohbet, Dosyalar, Terminal, Editör, Bilgisayar (RDP), Otomasyonlar, Hosting |
| **Stil arketipi** | **Workstation Minimal** — IDE ile sohbet uygulamasının ortasında, dikkat dağıtmayan, içerik öncelikli, koyu mod birinci sınıf |

### Anti-stiller (KULLANMA)
- Glassmorphism / blur fest (terminal & editör okunabilirliğini öldürür)
- Brutalism, neon gradients, "Stripe-clone" pastel marketing UI
- Skeuomorphic gölge yığınları, neumorphism iç gölgeler
- Tema renklerinin dışında ad-hoc HEX (`text-[#3b82f6]` gibi) — tüm renkler tokendan gelir

---

## 2 · Token Mimarisi

İki katman vardır. Yeni token eklemek istiyorsan **her ikisini** de güncelle.

### 2.1 CSS değişkenleri (semantic) — `globals.css` `:root` & `.dark`

Bu dosya kanonik kayıttır. Aşağıdaki tablo o dosyayı **özetler**, eklemez.

| Token | Light | Dark | Kullanım |
| --- | --- | --- | --- |
| `--background` | warm-neutral 0.985 | graphite 0.13 | Sayfa zemini |
| `--foreground` | ink 0.15 | snow 0.93 | Birincil metin |
| `--card` / `--card-foreground` | white | 0.17 graphite | Yüzey + metin |
| `--popover` | white | 0.17 | Menü, dropdown, tooltip |
| `--primary` | blue-teal 0.55/240 | blue-teal 0.65/240 | CTA, focus ring, marka vurgusu |
| `--secondary` | 0.955 neutral | 0.22 | İkincil yüzey |
| `--muted` / `--muted-foreground` | 0.955 / 0.5 | 0.22 / 0.6 | Düşük öncelikli içerik |
| `--accent` | 0.955 | 0.22 | Hover yüzey |
| `--destructive` | red 0.577/27 | red 0.65/25 | Yıkıcı eylem, hata |
| `--success` | green 0.62/155 | green 0.7/155 | Başarı, çalışıyor |
| `--warning` | amber 0.74/75 | amber 0.78/75 | Uyarı, durdurulmuş |
| `--info` | = primary | = primary | Bilgi durumu |
| `--border` / `--input` | 0.91 | 0.25 | Çizgi, ayırıcı, input kenarı |
| `--ring` | = primary | = primary | Klavye odak halkası |
| `--sidebar*` | 7 ayrı token | 7 ayrı token | Sol panel ayrı bağlam |
| `--chart-1..5` | 5 renkli paleti | dark eşleniği | Grafik serileri |

**Renk uzayı:** OKLCH (perceptually uniform). HSL/HEX **EKLEME**. Yeni renk gerekirse `oklch(L C H)` formunda ekle.

**Genişlik kuralı:** Bir token bir niyettir. Aynı niyet için iki token oluşturma. Örn: hata kırmızısı yalnızca `destructive`, "danger" diye ikincisi yok.

### 2.2 Tailwind v4 `@theme inline` köprüsü

`globals.css:7-55` her CSS değişkenini Tailwind utility'sine bağlar. Bu sayede:

- `bg-background`, `text-foreground`, `border-border`, `ring-ring` → tokendan gelir
- `bg-primary text-primary-foreground` → CTA paterni
- `bg-card border-border` → tüm kartlar
- `text-muted-foreground` → ikincil metin

**Kural:** UI kodunda **her zaman** semantic Tailwind utility kullan (`bg-card`), asla raw renk (`bg-white`, `bg-zinc-900`) yazma. Tek istisna: `globals.css` içindeki keyframe’ler.

### 2.3 Radius ölçeği

```
--radius: 0.625rem  /* 10px temel */
sm  = 0.6 × radius   ≈ 6px   → input, badge, küçük buton
md  = 0.8 × radius   ≈ 8px   → buton, küçük kart
lg  = 1.0 × radius   = 10px  → kart, dialog, popover (varsayılan)
xl  = 1.4 × radius   ≈ 14px  → büyük yüzey, modal
2xl = 1.8 × radius   ≈ 18px  → hero kart
```

Tam dairesel: `rounded-full` (avatar, dot, pill).

---

## 3 · Tipografi

### 3.1 Aileler

| Rol | Font | CSS değişkeni |
| --- | --- | --- |
| Sans (varsayılan) | **Geist Sans** | `--font-sans` |
| Mono (kod, terminal, ID) | **Geist Mono** | `--font-mono` |
| Heading | Geist Sans (ayrı ailesi yok) | `--font-heading` = sans |

`layout.tsx` içinde `next/font/google` ile yüklenir, `display: swap`. **Yeni font ekleme** — alt-ayar (Geist'in OpenType özellikleri zaten açık: `cv11, ss01, ss03, cv05`).

### 3.2 Ölçek (modüler, 1.125 oranı yerine pratik adımlar)

| Token | Boyut | Satır | Kullanım |
| --- | --- | --- | --- |
| `text-xs` | 12px | 16 | Etiket, badge, küçük yardım metni |
| `text-sm` | 14px | 20 | **Body varsayılanı** (uygulama yoğun) |
| `text-base` | 16px | 24 | Pazarlama / okuma yoğun |
| `text-lg` | 18px | 28 | Kart başlığı |
| `text-xl` | 20px | 28 | Bölüm başlığı |
| `text-2xl` | 24px | 32 | Sayfa başlığı |
| `text-3xl` | 30px | 36 | Hero (sadece auth & landing) |

**Ağırlık:** 400 (body), 500 (UI elemanlar, label), 600 (başlık), 700 (sadece hero). 800/900 yok.

**Tracking:** Gövde için varsayılan. Caps başlıklar için `tracking-wide` veya `tracking-tight` (sadece `text-2xl+`).

### 3.3 Kurallar

- Bir ekranda **en fazla 4 boyut** görünsün (hero hariç).
- İkincil metin daima `text-muted-foreground`.
- ID, hash, dosya yolu, kod parçası → `font-mono text-xs`.
- Türkçe metni Latin Extended-A glifleriyle test et (ş, ğ, ı, İ).

---

## 4 · Boşluk & Düzen

### 4.1 Spacing rhythm — 4px tabanı

`p-1`(4) `p-2`(8) `p-3`(12) `p-4`(16) `p-6`(24) `p-8`(32) `p-12`(48). 5/7/9/11 değerlerini **kullanma**.

### 4.2 Yoğunluk haritası

| Bağlam | Padding | Gap |
| --- | --- | --- |
| Form alanı / liste satırı | `py-2 px-3` | `gap-2` |
| Kart | `p-4` (kompakt) / `p-6` (varsayılan) | `gap-4` |
| Dialog gövdesi | `p-6` | `gap-4` |
| Sayfa içi container | `px-6 py-4` | `gap-6` |
| Sidebar item | `px-3 py-2` | `gap-2` |

### 4.3 Container patterns

- **Application shell** (varsayılan): `apps/web/src/components/app-shell/app-shell.tsx` her ana sayfayı sarar. Sayfalar `min-h-dvh` ile sınırlanır, `<div className="flex h-full">` modeline uyar.
- **Marketing / auth**: `max-w-md mx-auto` (auth), `max-w-4xl mx-auto` (içerik), `px-4 sm:px-6`.
- **Workspace 3-pane**: `react-resizable-panels` — sol dosya ağacı, orta editör, sağ sohbet. Persist edilmiş boyutlar (kullanıcı tercih ettiği genişliği hatırlar).

### 4.4 Breakpoint felsefesi

Bu bir **desktop-first uygulamadır**. `<768px` mobil deneyim _bilgilendirici_ (read-only) olur, çoğu güç-kullanıcı yüzeyi (terminal, editör, bilgisayar paneli) `lg:` (1024px) altında daraltılmış sürüm gösterir.

Tailwind kırılımları: `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536. Mobil için ek breakpoint ekleme.

---

## 5 · Yükseklik & Kenar

| Seviye | Sınıf | Kullanım |
| --- | --- | --- |
| 0 | `border` | Statik kart, panel ayrımı |
| 1 | `shadow-sm` | Yüzen kartlar, hover |
| 2 | `shadow-md` | Dropdown, popover, tooltip |
| 3 | `shadow-lg` | Dialog, modal |
| 4 | `shadow-xl` | Komut paleti (overlay) |

**Yığma kuralı:** Aynı yüzeyde 2'den fazla seviye yan yana olmasın. Modal içinde shadow-md kart **yok**.

`border` yerine gölge tek başına kullanma — koyu modda gözden kaybolur. Daima `border + shadow` çifti.

---

## 6 · Hareket (Motion)

### 6.1 Süreler

| Token | ms | Easing | Kullanım |
| --- | --- | --- | --- |
| Instant | 0 | — | Görüntü değişimi (theme switch — flicker engelle) |
| Micro | 100–150 | ease-out | Hover, focus, basma |
| Short | 200–250 | ease-in-out | Dialog/popover açılışı |
| Medium | 300–400 | ease-in-out | Sayfa geçişi, panel boyutu |
| Long | 600+ | custom | **Sadece** ambient (aurora) |

### 6.2 Mevcut keyframes (`globals.css:191-211`)

`aurora-drift` (22s/32s), `slow-pulse` (6s), `star-twinkle` (4s/6s). Bunlar **dekoratif** — ana eylem akışlarında kullanma. Auth, landing, dashboard hero gibi düşük yoğunluklu yüzeylerde uygundur.

### 6.3 Reduced motion (zorunlu)

`globals.css:162-171` `prefers-reduced-motion: reduce` için tüm animasyonları 0.01ms'ye indirir. **Yeni animasyon eklerken** `@media (prefers-reduced-motion: no-preference)` içine sar veya `animate-*` utility’sini globals.css’teki paterne ekle.

### 6.4 Yasak

- Bouncy spring (overshoot >5%) — UI elemanlarında
- Decoratif rotate / wobble
- Loading "shimmer" yerine `Skeleton` component (ui/loading-skeleton.tsx)
- Auto-playing video / parallax scroll-jack

---

## 7 · Component sözleşmeleri

shadcn temel kütüphanesi (`apps/web/src/components/ui/*`) **tek doğru implementasyondur**. Yenisini eklemeden önce var olanı genişlet.

### 7.1 Button (`ui/button.tsx`)

| Variant | Kullanım |
| --- | --- |
| `default` | Birincil eylem (sayfa başına 1 tane) |
| `secondary` | İkincil eylem |
| `outline` | Üçüncül, kart içi |
| `ghost` | Toolbar, ikon butonu |
| `link` | Inline metin eylemi |
| `destructive` | Sil / iptal etmez, **yıkıcı** olan |

Boyutlar: `sm` (32), `default` (36), `lg` (40), `icon` (36×36). Loading durumunda `disabled` + spinner. Çift tıklama koruması zorunlu (debounce / `isPending`).

### 7.2 Input / Textarea / Select

- Yükseklik: `h-9` varsayılan (36px). Form yoğun yerde `h-8` izinli.
- Hata: `aria-invalid="true"` + altta `text-destructive text-xs` mesaj. Border kırmızı yerine **ring** kullan.
- Label daima görünür (placeholder label değildir). Required → `*` muted-foreground ile.

### 7.3 Dialog vs Drawer vs Popover vs Sheet

| Yüzey | Kullanım | Min/maks |
| --- | --- | --- |
| **Tooltip** | Yardımcı bilgi (≤ 1 satır) | <120 char |
| **Popover** | Hızlı seçim, filtre, mini form | <400px |
| **Dialog** | Onay, küçük form, içerik fokusu | 400–640px |
| **Sheet** | Geniş form, detay paneli | 480–720px |
| **Drawer** | Mobil bottom sheet | 100% |
| **AlertDialog** | **Sadece** yıkıcı / geri alınamaz onay | <400px |

Dialog içinde Dialog **yok**. Modal stacking sayfa basitleştirme sinyalidir.

### 7.4 Empty state (`ui/empty-state.tsx`)

Her liste/feed için **3 durum** zorunlu:
1. **Loading** → `Skeleton` (yapı koruyan)
2. **Empty** → `EmptyState` componenti: ikon + başlık + 1 cümle + birincil CTA
3. **Error** → `ErrorBoundary` + retry butonu

### 7.5 Toaster (sonner)

`<Toaster richColors />` `(main)/layout.tsx`'te global. Kurallar:
- Süre: success 3s, info 4s, error/warning 6s
- Aksiyon butonu olan toast → **kapatma garantili** olmalı
- Aynı eylemden 3+ toast birikirse `id` ile dedupe et
- Kritik hata için toast yetmez → inline error veya dialog

### 7.6 StatusBadge (`ui/status-badge.tsx`)

Token-haritası:

| Durum | Token | Örnek |
| --- | --- | --- |
| Active / running / connected | `success` | Workspace çalışıyor |
| Pending / queued | `warning` | Otomasyon bekliyor |
| Error / failed | `destructive` | Job başarısız |
| Idle / archived | `muted` | Snapshot eski |
| Info | `info` (=primary) | Yeni özellik |

Dot + metin paterni. Yalnız renk taşıma (sadece kırmızı dot) **kabul edilmez** — daima ikon veya metin eşlik etmeli (a11y).

---

## 8 · Erişilebilirlik (a11y) — Anlaşma değil zorunluluk

WCAG 2.1 AA hedeftir. Kontrol listesi:

- [ ] **Klavye navigasyonu**: tüm interaktif element Tab ile ulaşılır, Esc dialog/popover kapatır, Enter/Space aktive eder.
- [ ] **Focus visible**: `:focus-visible` global stil var (`globals.css:155-159`). Bunu `outline-none` ile **EZME**.
- [ ] **Skip link**: `layout.tsx:40-42` → "Ana içeriğe geç". `<main id="main-content">` zorunlu.
- [ ] **Kontrast**: gövde metin ≥ 4.5:1, büyük metin ≥ 3:1, UI elemanı ≥ 3:1. Tokenlar bu sınırları sağlıyor; `muted-foreground` üzerinde `muted` zemin → **HER İKİ MOD**ta test et.
- [ ] **ARIA**: shadcn defaultları yeterli; manuel `role` eklemeden önce native HTML yeterli mi diye sor.
- [ ] **Form etiketleri**: her `<input>` `<label htmlFor>` eşliğinde. Label gizli olacaksa `sr-only`.
- [ ] **Hata duyurusu**: `aria-live="polite"` form altındaki error özetinde, `aria-live="assertive"` toast’ta.
- [ ] **Renk tek başına anlam taşımaz**: ikon + metin + renk üçlüsü.
- [ ] **Reduced motion**: bkz §6.3.
- [ ] **Dil**: `<html lang="tr">` (zaten ayarlı). İngilizce metin gerekiyorsa `lang="en"` ile sar.
- [ ] **Touch targets**: min 36×36 desktop, **44×44 mobil**.

---

## 9 · Tema & koyu mod

Provider: `next-themes` (sınıf tabanlı, `.dark` class’ı `<html>` üzerinde).

Kurallar:
- Renk yazma yerine **token kullan** → otomatik koyu mod uyumu.
- Görüntü/illüstrasyon eklerken **her iki mod** için ayrı asset veya CSS filter (`dark:invert`).
- `suppressHydrationWarning` `<html>`'te (zaten var) — ek olarak kullanma.
- Tema toggle: `ui/theme-toggle.tsx` tek noktadan; başka theme UI yapma.

---

## 10 · Dosyalama & İsimlendirme

Bkz `AGENTS.md` § Conventions. Tasarım tarafı için:

- Component dosyası: kebab-case (`status-badge.tsx`).
- Class kompozisyonu: `cn()` helper (`@/lib/utils`).
- Variant API: `class-variance-authority` (cva). Yeni component yazarken **CVA ile başla**, ad-hoc `clsx` zinciri yapma.
- Türkçe UI metni component içinde **literal** olarak kalır (i18n şu an proje dışında). Anahtarları gelecekte taşıyabilmek için ayırt edici cümle kullan.

---

## 11 · Performans (UI bütçesi)

| Metrik | Hedef |
| --- | --- |
| LCP (auth, dashboard) | < 2.0s (cable) |
| INP | < 200ms |
| CLS | < 0.05 (skeleton zorunlu) |
| Initial JS (sayfa başına) | < 200KB gz |
| `next/image` | tüm raster görseller |
| `next/font` | tüm fontlar (zaten kullanılıyor) |
| Liste virtualizasyonu | > 200 item için zorunlu (`@tanstack/react-virtual`) |
| Monaco / xterm | dynamic import + Suspense fallback |

**Yasak:** Sayfa açılışında `Toaster` dışında global kütüphane import etme. Heavy component (Monaco, xterm, recharts) yalnız ihtiyaç anında.

---

## 12 · Sayfa override pattern

Bu master kontratın üstüne bir sayfa **istisna** koyabilir; bu istisnalar `design-system/pages/<route>.md` dosyasına yazılır. Override **eklemek**, master'i kopyalamak değildir — yalnız fark belgelenir. Şablon:

```md
# /<route> · Sayfa override

## Niye fark var
Bu sayfa <bağlam>. Master kontratından şu noktalarda sapar:

## Sapmalar
- Boşluk: `p-0` (terminal full-bleed)
- Renk: `bg-zinc-950` zorla (xterm temasıyla eşleşme)
- Tipografi: `font-mono` her yerde

## Hâlâ master’a uyan kurallar
- Tüm a11y kontrolleri
- Buton variantları
- Hareket süreleri
```

Dosyalar `pages/` altında. Var olanlar:
- `pages/chat.md` — split-panel sohbet + AI mesaj balonu konvansiyonu
- `pages/terminal.md` — xterm full-bleed, monospace lock

---

## 13 · Pre-Delivery Checklist

Yeni bir ekran / component PR’ı açmadan önce:

- [ ] Tüm renkler token (raw HEX/HSL yok)
- [ ] Loading + Empty + Error üç durumu var
- [ ] Klavye ile baştan sona dolaşılabiliyor
- [ ] `:focus-visible` görünüyor (manuel test)
- [ ] Light + Dark her ikisinde test edildi
- [ ] `prefers-reduced-motion: reduce` ile animasyonlar duruyor
- [ ] Türkçe karakter taşma yok (`ş, ğ, İ`)
- [ ] Mobile (768px) en azından read-only çalışıyor
- [ ] `pnpm --filter web typecheck` temiz
- [ ] `pnpm --filter web lint` temiz
- [ ] LCP ölçümü Network: Slow 4G ile < 2.5s
- [ ] Sonner toast spam yok (3+ aynı id dedupe)
- [ ] AGENTS.md çekirdek konvansiyonlarına uygun (route → service → repo katmanı; tenant filtresi)

---

## 14 · Anti-pattern kataloğu

| Yapma | Neden |
| --- | --- |
| `bg-white text-black` | Token ezer, koyu modda kırılır |
| `<div onClick>` interaktif | a11y. `<button>` veya shadcn primitive kullan |
| `setTimeout` ile UI animasyonu | CSS animasyon + reduced-motion bypass’ı atlar |
| 3+ modal stack | UX kokusu — flow’u sadeleştir |
| Renkli border destructive yerine ring | Renk körü için yetersiz |
| Sonsuz scroll + üst sticky toolbar + alt sticky bar | İçerik daralır, mobilde kaybolur |
| `Tooltip` içinde interaktif | Klavye/dokunmatik kullanıcı erişemez |
| Yoğun emoji ikon | Marka tutarsızlığı; `lucide-react` kullan |
| `position: absolute` ile iskelet kurmak | `flex`/`grid` tercih et; absolute yalnız overlay |

---

## 15 · Kaynaklar

- **Kanonik token kayıtları:** `apps/web/src/app/globals.css`
- **Component primitives:** `apps/web/src/components/ui/`
- **App shell:** `apps/web/src/components/app-shell/app-shell.tsx`
- **Provider zinciri:** `apps/web/src/components/providers.tsx` (theme, query, tooltip)
- **Repo konvansiyonları:** `AGENTS.md`
- **Skill referansı (gözden geçirme):** `.agents/skills/ui-ux-pro-max/SKILL.md`
