# React 19 — apps/web

## Server Action (inline)

```tsx
// app/page.tsx (Server Component)
import LikeButton from './LikeButton';

let count = 0;
export default function App() {
  async function addLike() {
    'use server';
    count++;
  }
  return <LikeButton addLike={addLike} />;
}
```

```tsx
// LikeButton.tsx
'use client';
export default function LikeButton({ addLike }: { addLike: () => Promise<void> }) {
  return <form action={addLike}><button type="submit">Like</button></form>;
}
```

## useActionState (form + server function)

```tsx
'use client';
import { useActionState } from 'react';
import requestUsername from './requestUsername';

export function UsernameForm() {
  const [state, action] = useActionState(requestUsername, null, 'n/a');
  return (
    <form action={action}>
      <input name="username" />
      <button>Request</button>
      <p>Last: {state}</p>
    </form>
  );
}
```

## useTransition + async update

```tsx
const [quantity, updateQuantityAction, isPending] = useActionState(
  async (_prev, payload) => {
    return await updateQuantity(payload);
  },
  1,
);
```

## useEffect ile bağlantı yönetimi

```tsx
useEffect(() => {
  const conn = createConnection(serverUrl, roomId);
  conn.connect();
  return () => conn.disconnect();
}, [roomId]);
```

## Custom hook pattern

```tsx
function useOnlineStatus() { /* ... */ }
function StatusBar() {
  const isOnline = useOnlineStatus();
  return <h1>{isOnline ? '✅' : '❌'}</h1>;
}
```

## Kurallar
- Component'leri JSX içinde kullan, fonksiyon olarak çağırma.
- Hook'u yalnızca component/Hook gövdesinde çağır.
- Server Action'lar için `'use server'`, client component için `'use client'` direktifi.
