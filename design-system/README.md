# Zihinbulut Design System

Tek doğruluk kaynağı: **`MASTER.md`**.

## Yapı

```
design-system/
├── MASTER.md             ← her UI kararı buradan başlar
├── pages/
│   ├── README.md         ← override yazma kuralları
│   ├── chat.md           ← /chats/[id]
│   └── terminal.md       ← /terminal + workspace terminal
└── README.md             ← bu dosya
```

## Yeni bir ekran tasarlarken / kodlarken sıralama

1. **MASTER.md’yi oku** — özellikle §2 (token), §7 (component), §8 (a11y), §13 (checklist).
2. Sayfanın `pages/` altında bir override’ı var mı? Varsa **yalnız fark** kısmı geçerli; geri kalan master’dır.
3. Yeni bir override yazmadan önce: gerçekten master ihlali zorunlu mu? Çoğu zaman değil — master’ı genişlet.
4. PR açmadan §13 Pre-Delivery Checklist’i geç.

## Token değişikliği nasıl yapılır?

1. `apps/web/src/app/globals.css` içinde CSS değişkenini ekle/düzenle (`:root` **ve** `.dark`).
2. Aynı dosyanın `@theme inline` bloğuna Tailwind köprüsünü ekle (`--color-foo: var(--foo);`).
3. `MASTER.md` §2’deki tabloyu güncelle.
4. Etkilenen tüm component’leri `pnpm --filter web typecheck && pnpm --filter web lint` ile doğrula.

## Bilinen eksikler / yapılacaklar

- [ ] `--terminal-bg` / `--terminal-fg` token’larını `globals.css`’e ekle (şu an `pages/terminal.md` öneriyor)
- [ ] Workspace 3-pane layout (`pages/workspace.md`) — yazılmadı
- [ ] Computer (RDP) ekranı override (`pages/computer.md`) — yazılmadı
- [ ] Auth/marketing yüzeyleri (`pages/auth.md`) — yazılmadı, hero scale ihtiyacı var
- [ ] Storybook / component galerisi yok; `ui/` altındakiler manuel review

## LLM/Agent için hatırlatma (hierarchical retrieval)

Bir UI değişikliği isteğinde:

1. Önce `MASTER.md` özetini bağlama yükle
2. Etkilenen route’u tespit et → varsa `pages/<route>.md`’yi de yükle
3. İlgili component dosyasını oku (`apps/web/src/components/ui/<name>.tsx`)
4. Token değişikliği gerekiyorsa `globals.css`’i de oku
5. Pre-Delivery Checklist’i (§13) **çıktıdan önce** uygula

Master’ı her seferinde tam yüklemek yerine yalnız ilgili bölüm (§ numarası) referans gösterilebilir.
