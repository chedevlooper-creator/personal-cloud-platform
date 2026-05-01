# /terminal · override

## Bağlam
xterm.js tabanlı tam ekran terminal (workspace içinde de gömülü panel olarak kullanılır). Bir IDE terminali gibi davranır: full-bleed, zero-chrome, monospace lock.

## Sapmalar

### Renk
- Zemin **her iki temada koyu**: `bg-[var(--terminal-bg)]` → light’ta `oklch(0.18 0.01 260)`, dark’ta `oklch(0.11 0.008 260)`. Yeni token: `--terminal-bg`, `--terminal-fg` (master §2’ye eklenmeli).
- Master kuralı "raw renk yok"un istisnası: xterm `theme` objesi HEX bekler. Bu HEX’ler **yalnız** `components/workspace/terminal-*.tsx` içinde olabilir; başka yerde kullanma.

### Tipografi
- `font-mono` her yerde (status bar dahil).
- Boyut: 13px (varsayılan); kullanıcı ayarından 12 / 14 / 15.
- Cursor: blok, blink (xterm default).

### Boşluk
- `p-0` — chrome yok. Üstte 32px ince status bar (workspace adı, çalışma dizini, durum). Statusbar `bg-card border-b border-border`.
- ResizeObserver ile xterm `fit` (gecikme: 100ms throttle).

### Hareket
- Animasyon **yok**. Açılış/kapanış instant. xterm’in kendi imleç blink’ı `prefers-reduced-motion: reduce`’ta da çalışır (xterm internal) — manuel kapatma yapma, low-priority.

### Klavye
- Bütün kısayollar terminale gider (Ctrl+C, Ctrl+L, vs). Uygulama kısayolları **yalnız** `Cmd/Ctrl+Shift+*` namespace’i. Master’daki Esc-kapatır kuralı **bu sayfada geçersiz**.

## Hâlâ master’a uyar
- Status bar buton/badge’leri shadcn (StatusBadge, Button ghost) — master §7
- A11y: terminal canvas’ın `aria-label="Terminal — <workspace adı>"`. Klavye odağı görsel ring (xterm focused state).
- Reduced motion ortamlarında, status bar animasyonları durur.
- Kapatma onayı yıkıcı işlem değil → AlertDialog **yok**, normal Dialog yeterli.

## Test
- 80×24 ile 200×60 yeniden boyutlandırma sırasında satır kırılması yok
- Light/dark geçiş anında terminal teması güncellenir (theme listener xterm’i resetler)
- 1MB log paste edilirse UI freeze yok (xterm scrollback default 1000 → ayarlanabilir, üst sınır 10000)
- Bağlantı koparsa status bar `destructive` badge + "Yeniden bağlan" butonu (master §7.4 error state)
