# Next.js 16 (App Router) — apps/web

## Server Component + Data Fetching

```tsx
// apps/web/src/app/(main)/some/page.tsx
async function getData() {
  const res = await fetch('https://...', { cache: 'no-store' });
  return res.json();
}

export default async function Page() {
  const data = await getData();
  return <ClientView data={data} />;
}
```

## Route Handler (REST)

```ts
// apps/web/src/app/api/<route>/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const param = request.nextUrl.searchParams.get('q');
  if (!param) return new Response('Bad Request', { status: 400 });
  return NextResponse.json({ ok: true, param });
}
```

## Client navigation

```tsx
'use client';
import { useRouter } from 'next/navigation';

export default function Btn() {
  const router = useRouter();
  return <button onClick={() => router.push('/dashboard')}>Go</button>;
}
```

## Link

```tsx
import Link from 'next/link';
export default function Nav() {
  return <Link href="/workspace">Workspace</Link>;
}
```

## useParams (works in App + Pages)

```tsx
import { useParams } from 'next/navigation';
const params = useParams<{ slug: string }>();
```

## Root layout

```tsx
// apps/web/src/app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

## Proje notları
- Next.js 16 + React 19: `params` ve `searchParams` artık async (Promise). Sayfalarda `const { slug } = await params` kullanın.
- `apps/web/src/proxy.ts` middleware/proxy yüzeyidir; auth cookie validation buraya merkezileştirilebilir.
- `cache: 'no-store'` ile her istek dinamik fetch yapar; agent/workspace UI'sinde tenant verisi için varsayılan.
- Client Component için `'use client'`; xterm/Monaco gibi browser-only modüller burada.
