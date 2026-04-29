# Vitest — services/* tests

## Config (alias virtual modules)

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    alias: {
      // mock external module
      vscode: resolve(import.meta.dirname, './mock/vscode.js'),
    },
  },
});
```

## Mock virtual / external module

```ts
import { vi } from 'vitest';
vi.mock(import('vscode'), () => ({
  window: { createOutputChannel: vi.fn() },
}));
```

## fs mocking with memfs

```ts
import { beforeEach, expect, it, vi } from 'vitest';
import { fs, vol } from 'memfs';

vi.mock('node:fs');
vi.mock('node:fs/promises');

beforeEach(() => vol.reset());

it('reads', () => {
  fs.writeFileSync('/hello.txt', 'hi');
  expect(readHello('/hello.txt')).toBe('hi');
});
```

## MSW for HTTP mocking

```ts
import { afterAll, afterEach, beforeAll } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer(
  http.get('https://api.example.com/posts', () => HttpResponse.json({ posts: [] })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
```

## Require assertions

```ts
// vitest.config.ts
export default defineConfig({
  test: { expect: { requireAssertions: true } },
});
```

## inject test projects (multi-package)

```ts
const projs = await injectTestProjects({
  extends: project.vite.config.configFile,
  test: { name: 'integration', alias: { '@/db': resolve('./mocks/db.ts') } },
});
```

## Proje notları
- `services/auth` ve `services/workspace` Vitest 4.x kullanıyor; diğerleri 1.x — birleştirme yaparken API farkına dikkat.
- Fastify integration test'i için `app.inject({ method, url, payload })` ideal — gerçek port açma.
- DB integration test'leri için `pg-mem` veya gerçek Postgres + transaction rollback fixture.
