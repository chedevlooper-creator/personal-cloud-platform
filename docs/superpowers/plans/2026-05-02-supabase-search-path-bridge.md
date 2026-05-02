# Supabase Search Path Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Drizzle table definitions target Supabase's `cloudmind` schema without rewriting every schema file in this slice.

**Architecture:** Add a focused DB connection helper that normalizes `DB_SEARCH_PATH` and passes it to `postgres` as a connection startup parameter. Keep `cloudmind,public` as the default so Supabase resolves application tables in `cloudmind`, while local public-schema databases still work as a fallback. Wire this helper into the runtime client and Drizzle Kit config.

**Tech Stack:** TypeScript, Drizzle ORM, postgres.js, Node test runner, pnpm.

---

### Task 1: Add Search Path Connection Helper

**Files:**
- Create: `packages/db/src/connection-options.ts`
- Test: `packages/db/src/connection-options.test.ts`
- Modify: `packages/db/package.json`
- Modify: `package.json`
- Modify: `scripts/baseline-smoke.mjs`

- [x] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_DB_SEARCH_PATH,
  createPostgresOptions,
  normalizeDbSearchPath,
} from './connection-options';

describe('connection options', () => {
  it('defaults DB connections to cloudmind before public', () => {
    assert.equal(DEFAULT_DB_SEARCH_PATH, 'cloudmind,public');
    assert.equal(normalizeDbSearchPath(undefined), 'cloudmind,public');
    assert.deepEqual(createPostgresOptions({ maxConnections: 10 }), {
      max: 10,
      connection: { search_path: 'cloudmind,public' },
    });
  });

  it('normalizes explicit DB_SEARCH_PATH values', () => {
    assert.equal(normalizeDbSearchPath(' cloudmind, public ,, '), 'cloudmind,public');
    assert.deepEqual(
      createPostgresOptions({ maxConnections: 4, searchPath: ' public ' }),
      {
        max: 4,
        connection: { search_path: 'public' },
      },
    );
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `corepack pnpm --filter @pcp/db exec tsx --test src/connection-options.test.ts`
Expected: FAIL with missing `./connection-options`.

- [x] **Step 3: Write minimal implementation**

```ts
import type postgres from 'postgres';

export const DEFAULT_DB_SEARCH_PATH = 'cloudmind,public';

export function normalizeDbSearchPath(value: string | null | undefined): string {
  const raw = value?.trim() ? value : DEFAULT_DB_SEARCH_PATH;
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(',') : DEFAULT_DB_SEARCH_PATH;
}

export function createPostgresOptions(input: {
  maxConnections: number;
  searchPath?: string | null;
}): postgres.Options<Record<string, postgres.PostgresType>> {
  return {
    max: input.maxConnections,
    connection: {
      search_path: normalizeDbSearchPath(input.searchPath),
    },
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `corepack pnpm --filter @pcp/db exec tsx --test src/connection-options.test.ts`
Expected: PASS.

- [x] **Step 5: Add db test scripts to baseline**

Modify `packages/db/package.json`:

```json
"test": "tsx --test src/**/*.test.ts"
```

Modify root `package.json` and `scripts/baseline-smoke.mjs` so `@pcp/db` participates in `pnpm test` and `smoke:local`.

### Task 2: Wire Runtime DB Client and Drizzle Kit

**Files:**
- Modify: `packages/db/src/client.ts`
- Modify: `packages/db/drizzle.config.ts`
- Test: `packages/db/src/connection-options.test.ts`

- [x] **Step 1: Extend the helper test for env-shaped input**

Add an assertion that `createPostgresOptions({ maxConnections: 12, searchPath: 'cloudmind,public' })` returns `connection.search_path` equal to `cloudmind,public`.

- [x] **Step 2: Wire runtime client**

Update `packages/db/src/client.ts` to parse `DB_SEARCH_PATH` and pass `createPostgresOptions({ maxConnections: env.DB_MAX_CONNECTIONS, searchPath: env.DB_SEARCH_PATH })` into `postgres`.

- [x] **Step 3: Wire Drizzle Kit**

Update `packages/db/drizzle.config.ts` to parse `DB_SEARCH_PATH` and pass:

```ts
dbCredentials: {
  url: env.DATABASE_URL,
},
schemaFilter: normalizeDbSearchPath(env.DB_SEARCH_PATH).split(','),
```

If `schemaFilter` is not accepted by the current `drizzle-kit` types, keep migration config unchanged and rely on runtime search path in this slice.

- [x] **Step 4: Verify**

Run:

```bash
corepack pnpm --filter @pcp/db test
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm smoke:local
```

Expected: all pass.

- [x] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-05-02-supabase-search-path-bridge.md packages/db package.json scripts/baseline-smoke.mjs
git commit -m "feat: bridge drizzle to cloudmind schema"
```
