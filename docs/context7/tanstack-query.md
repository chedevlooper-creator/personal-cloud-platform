# TanStack Query (React) — apps/web

## Mutation + invalidation

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

const qc = useQueryClient();
const m = useMutation({
  mutationFn: addTodo,
  onSuccess: async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['todos'] }),
      qc.invalidateQueries({ queryKey: ['reminders'] }),
    ]);
  },
});
```

## Optimistic update via setQueryData

```ts
const useMutateTodo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: editTodo,
    onSuccess: (data, vars) => qc.setQueryData(['todo', { id: vars.id }], data),
  });
};
```

## onSettled (kalıcı pending)

```ts
useMutation({
  mutationFn: addTodo,
  onSettled: () => qc.invalidateQueries({ queryKey: ['todos'] }),
});
```

## Prefix matching

```ts
qc.invalidateQueries({ queryKey: ['todos'] });
// ['todos'] ve ['todos', { page: 1 }] hepsi invalid olur.
```

## Mutation persistence (offline)

```ts
const state = dehydrate(queryClient);
// quit → restore on start
hydrate(queryClient, state);
queryClient.resumePausedMutations();
```

## Proje notları
- Tüm server state TanStack Query, client UI state Zustand (`apps/web/src/store/`).
- Query key sözleşmesi: `[domain, params]`, ör. `['workspace', workspaceId, 'files']`.
- Multi-tenant invalidation: workspace değişince `['workspace', oldId]` prefix'ini invalidate et.
