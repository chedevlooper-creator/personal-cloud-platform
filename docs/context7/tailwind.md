# Tailwind CSS v4 — apps/web

## CSS-first config (`@theme`)

```css
/* apps/web/src/app/globals.css */
@import "tailwindcss";

@theme {
  --color-mint-500: oklch(0.72 0.11 178);
  --font-display: "Satoshi", sans-serif;
  --breakpoint-3xl: 1920px;
}
```

## v3 → v4: theme() yerine var()

```css
/* eski */
.my { background: theme(colors.red.500); }

/* yeni */
.my { background-color: var(--color-red-500); }
```

## Inline var() kullanımı

```html
<div style="background-color: var(--color-mint-500)"></div>
```

## Prefix

```css
@import "tailwindcss" prefix(tw);
```

## Tüm default'ları sıfırla (custom theme)

```css
@theme {
  --*: initial;
  --spacing: 4px;
  --color-lagoon: oklch(0.72 0.11 221.19);
}
```

## Static (hep emit et)

```css
@theme static {
  --color-primary: var(--color-red-500);
}
```

## v3 ring uyumu

```css
@theme {
  --default-ring-width: 3px;
  --default-ring-color: var(--color-blue-500);
}
```

## Proje notları
- Tüm token'lar `apps/web/src/app/globals.css`'te.
- shadcn/ui v4 uyumluluk için `--color-*` değişkenleri tanımlı olmalı.
- Dark mode: `next-themes` + `[data-theme="dark"]` selector'ları.
