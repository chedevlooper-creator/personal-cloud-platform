# /chats/[id] · override

## Bağlam
AI sohbet yüzeyi. Kullanıcı ↔ asistan ↔ tool-call üçlüsü; sürekli streaming, mesaj başına 4+ alt-eylem (kopyala, branch, çalışma alanına uygula, dosyaya ekle). Master’daki "kart yoğunluğu" kuralları burada **gevşer**, çünkü mesaj listesi kendi başına bir akış yapısıdır.

## Sapmalar

### Mesaj balonu
- **Kart yok.** `Card` bileşeni kullanma — mesajlar `<article>` + minimal padding (`py-4 px-1`).
- Ayraç: `border-b border-border/50` ile mesajlar arası ince çizgi, gölge yok.
- Kullanıcı mesajı: `bg-muted/40 rounded-xl px-4 py-3` (kart-light); asistan: zeminsiz.
- Maksimum genişlik: `max-w-3xl mx-auto` — okuma satır uzunluğunu koru.

### Tipografi
- Body `text-[15px] leading-7` (master’ın 14/20’si bu sayfada **fazla sıkı**). Kod blokları `text-sm`.
- Markdown render: `components/app-shell/markdown-*` üzerinden; başka markdown lib **kullanma**.

### Tool-call kartları
- Açılır/kapanır chevron ile. Kapalıyken yalnız `tool_name + status` (StatusBadge §7.6).
- Açıkken JSON input/output `font-mono text-xs bg-muted/40 rounded-md p-3 overflow-x-auto`.
- Uzun çıktı 12 satırdan sonra "…devamını göster" — virtualizasyon **mesaj başına yapılmaz**, sayfa scroller yeterli (sohbet uzunluk üst sınırı: 500 mesaj sonrası uyarı).

### Streaming göstergesi
- Yumuşak yanıp-sönen bir nokta `animate-slow-pulse` (master §6.2). Spinner yok.
- Ses **yok**. Otomatik scroll, kullanıcı yukarı kaydırırsa **devre dışı** (jump-to-bottom butonu görünür).

### Komut paleti & ekleme paneli
- `app:attach-file-to-chat` ve `app:apply-code-to-workspace` custom event’ları (`AGENTS.md` § Conventions). Bu sayfa **publisher** — başka yerden tetiklenir, burada handler’ı vardır.

## Hâlâ master’a uyar
- Tüm renkler token üzerinden (§2)
- Buton variantları (§7.1) — "Çalışma alanına uygula" → `default`, "Kopyala" → `ghost`
- A11y: mesaj listesi `role="log" aria-live="polite"`, streaming chunks duyurulmaz (yalnız tamamlandığında)
- Reduced motion: streaming nokta `prefers-reduced-motion`’da statik
- Empty state: yeni sohbet → ilham veren prompt önerileri (3 tane), Empty component (§7.4)

## Test (kabul kriterleri)
- 200 mesajlık sohbet 60fps scroll (Chrome perf panel)
- Klavye ile sohbete girilebiliyor: Tab → input, Esc → odak çıkışı, ↑ son mesajı düzenle
- Kod bloğu kopyalama tek tıkta panoya gider, başarı toast 3s
- Light + dark modda kullanıcı/asistan ayrımı net (göz testi)
- 1024px altında 3-pane → tek-pane (sohbet tam ekran), command palette ile geçiş
