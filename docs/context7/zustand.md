# Zustand — apps/web/src/store

## Basic + persist

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface WorkspaceState {
  activeWorkspaceId: string | null;
  setActive: (id: string) => void;
}

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set) => ({
      activeWorkspaceId: null,
      setActive: (id) => set({ activeWorkspaceId: id }),
    }),
    {
      name: 'cloudmind-workspace',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ activeWorkspaceId: s.activeWorkspaceId }),
    },
  ),
);
```

## Slices pattern (combine + persist at top)

```ts
export const useStore = create(
  persist(
    (...a) => ({
      ...createBearSlice(...a),
      ...createFishSlice(...a),
    }),
    { name: 'bound-store' },
  ),
);
```

## Clear persisted storage

```ts
useWorkspace.persist.clearStorage();
```

## Vanilla store (non-React)

```ts
import { createStore } from 'zustand/vanilla';
import { persist } from 'zustand/middleware';

const store = createStore<State>()(
  persist((set) => ({ /* ... */ }), { name: 'pos-storage' }),
);
```

## Proje notları
- Zustand sadece UI/Client state için (active workspace, editor durumu).
- API/server state için TanStack Query.
- `partialize` ile sadece persistlenmesi gerekenleri seç (auth token persistleme).
