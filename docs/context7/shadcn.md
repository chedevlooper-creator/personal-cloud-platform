# shadcn/ui — apps/web/src/components/ui

## CLI ile component ekleme

```bash
pnpm --filter web exec shadcn@latest add button card dialog dropdown-menu
```

## Import

```tsx
import { Button } from '@/components/ui/button';
```

## Dark mode (next-themes)

```bash
pnpm --filter web add next-themes
```

```tsx
// components/theme-provider.tsx
'use client';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

```tsx
// app/layout.tsx
<ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
  {children}
</ThemeProvider>
```

## Theme toggle

```tsx
'use client';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { MoonIcon, SunIcon } from 'lucide-react';

export function ModeToggle() {
  const { setTheme, theme } = useTheme();
  return (
    <Button variant="outline" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      <SunIcon className="size-4 dark:hidden" />
      <MoonIcon className="hidden size-4 dark:block" />
    </Button>
  );
}
```

## Next.js Link entegrasyonu (NavigationMenu render prop)

```tsx
import Link from 'next/link';
import { NavigationMenuItem, NavigationMenuLink, navigationMenuTriggerStyle } from '@/components/ui/navigation-menu';

<NavigationMenuItem>
  <NavigationMenuLink render={<Link href="/docs" />} className={navigationMenuTriggerStyle()}>
    Documentation
  </NavigationMenuLink>
</NavigationMenuItem>
```

## Calendar deps

```bash
pnpm --filter web add react-day-picker date-fns
```

## Proje notları
- shadcn v4: Tailwind v4 ile uyumlu, `--color-*` token'ları globals.css'te.
- `components.json`'da style/iconLibrary'yi sabit tut (mevcut: zaten `apps/web/components.json`).
- Yeni component eklerken `@/components/ui` yoluna sadık kal.
