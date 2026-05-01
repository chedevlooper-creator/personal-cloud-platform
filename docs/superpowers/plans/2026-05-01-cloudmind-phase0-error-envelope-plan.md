# CloudMind Phase 0 Error Envelope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the pre-pull stash against current `master` and complete the first production foundation slice around API error contracts, agent route safety, browser error mapping, and publish cleanup.

**Architecture:** Treat current `master` as the source of truth and recover only still-needed behavior from `stash@{0}`. Keep API error contracts in `packages/shared/src/errors.ts`, service-specific HTTP behavior in each service route file, and UI-facing error normalization in `apps/web/src/lib/api.ts`. Use focused Vitest regressions before each service change.

**Tech Stack:** TypeScript, pnpm 9, Fastify v4, fastify-type-provider-zod, Zod, Vitest, Drizzle, Dockerode.

---

## Scope Check

The approved design covers production hardening and UX across several subsystems. This plan only covers the first implementation slice:

- Phase 0 stash reconciliation.
- Phase 1 foundation start: canonical API error behavior and high-risk regressions that were present in the stash/review context.

Agent durability, workspace UX, runtime sandbox expansion, accessibility, and release readiness need separate plans after this one lands.

## File Structure

- Create: `docs/superpowers/reports/2026-05-01-stash-reconciliation.md`
  - Records what was inspected from `stash@{0}` and which changes are intentionally recovered or skipped.
- Modify: `services/agent/src/routes.test.ts`
  - Owns route-level regressions for agent SSE ownership and route error envelopes.
- Modify: `services/agent/src/routes.ts`
  - Owns agent HTTP/SSE behavior and must validate task ownership before opening a live event stream.
- Modify: `services/agent/src/env.test.ts`
  - Owns env isolation regressions around `AUTH_BYPASS` and production guards.
- Modify: `services/browser/vitest.config.ts`
  - Owns browser-service Vitest isolation from parent Vite/PostCSS config.
- Modify: `services/browser/src/routes.ts`
  - Owns browser route error-to-envelope mapping.
- Create: `services/browser/src/routes.test.ts`
  - Owns pure regression coverage for browser route status-code mapping.
- Modify: `services/publish/src/service.test.ts`
  - Owns publish lifecycle regressions around Docker container cleanup.
- Modify: `services/publish/src/service.ts`
  - Owns hosted container startup and cleanup behavior.

No full `git stash apply` or `git stash pop` is part of this plan.

### Task 1: Write The Stash Reconciliation Report

**Files:**
- Create: `docs/superpowers/reports/2026-05-01-stash-reconciliation.md`

- [ ] **Step 1: Re-run the stash inventory commands**

Run:

```bash
git status --short --branch
git stash list --date=local
git stash show --name-status 'stash@{0}'
git diff 'stash@{0}' HEAD -- packages/shared/src/errors.ts services/agent/src/routes.ts services/browser/vitest.config.ts services/publish/src/service.ts
```

Expected:

- Branch is clean except for the plan/report work from this implementation.
- `stash@{0}` is `codex-before-pull-2026-05-01`.
- The diff shows `packages/shared/src/errors.ts` already has `RATE_LIMITED` in current `HEAD`.
- The diff shows current `services/agent/src/routes.ts` has newer rate-limit/usage code and no one-shot `/agent/chat` route.
- The diff shows current `services/browser/vitest.config.ts` is missing service-local `root` and `css.postcss`.
- The diff shows current `services/publish/src/service.ts` is missing created-container cleanup after startup failure.

- [ ] **Step 2: Create the report**

Create `docs/superpowers/reports/2026-05-01-stash-reconciliation.md` with this content:

````markdown
# Stash Reconciliation Report

Date: 2026-05-01

## Source State

- Current branch: `master`
- Upstream base after pull: `420ba3a fix: restore chat flow and provider setup`
- Local design commit: `958d235 docs: add production ux design`
- Stash inspected: `stash@{0}: codex-before-pull-2026-05-01`

## Classification

| Area | Current status | Decision |
| --- | --- | --- |
| `packages/shared/src/errors.ts` | Current `HEAD` already includes `RATE_LIMITED`, canonical status mapping, default messages, `createApiErrorHandler`, and `sendApiError`. | Do not restore from stash. Keep current upstream implementation. |
| `services/agent/src/routes.ts` invalid attachment/input codes | Stash changed old custom codes to `BAD_REQUEST`; current `HEAD` no longer has those old custom codes. | Do not restore the old chat route just for this fix. |
| `services/agent/src/routes.ts` SSE ownership/current state | Current live SSE subscribes before proving task ownership and does not send current state before waiting for future events. | Recover behavior through focused tests and a small route change. |
| `services/agent/src/env.test.ts` `AUTH_BYPASS` isolation | Current tests do not force `AUTH_BYPASS=0`, so caller environment can affect production-guard expectations. | Recover the isolation fix and add an explicit production rejection test. |
| `services/browser/vitest.config.ts` | Current config can discover parent Vite/PostCSS config. | Recover service-local root and disabled PostCSS discovery while preserving current test globals. |
| `services/browser/src/routes.ts` | Current handler maps 400/429 service errors to 500. | Recover mapping, using `RATE_LIMITED` for 429. |
| `services/browser/src/service.ts` URL hardening | Current tests cover common private ranges and IPv4-mapped IPv6. Stash contains additional special-use ranges. | Defer broader SSRF range expansion to the browser/runtime hardening plan unless browser tests reveal a current gap. |
| `services/publish/src/service.ts` created container cleanup | Current code marks startup failure crashed but can leave a created container behind if `start()` or DB update fails. | Recover cleanup behavior through a regression test. |
| `.planning/**` | Stash contains large generated planning churn from the old GSD path. | Do not restore. Current Superpowers docs are the active planning artifacts. |
| `apps/web/**` lint-only tweaks | Stash contains minor web lint/style edits. | Do not restore unless a current lint run identifies the same issue. |

## Verification Target

The first implementation slice is complete when these commands pass:

```bash
corepack pnpm --filter @pcp/agent-service typecheck
corepack pnpm --filter @pcp/agent-service test
corepack pnpm --filter @pcp/browser-service typecheck
corepack pnpm --filter @pcp/browser-service test
corepack pnpm --filter @pcp/publish-service typecheck
corepack pnpm --filter @pcp/publish-service test
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
```
````

- [ ] **Step 3: Commit the report**

Run:

```bash
git add docs/superpowers/reports/2026-05-01-stash-reconciliation.md
git commit -m "docs: record stash reconciliation"
```

Expected: a docs-only commit.

### Task 2: Stabilize Agent Route Tests And Add SSE Ownership Regression

**Files:**
- Modify: `services/agent/src/routes.test.ts`

- [ ] **Step 1: Write the failing route regression**

Patch `services/agent/src/routes.test.ts` as follows:

```diff
diff --git a/services/agent/src/routes.test.ts b/services/agent/src/routes.test.ts
--- a/services/agent/src/routes.test.ts
+++ b/services/agent/src/routes.test.ts
@@
 import Fastify from 'fastify';
 import cookie from '@fastify/cookie';
+import { createApiErrorHandler } from '@pcp/shared';
 import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
 import { beforeEach, describe, expect, it, vi } from 'vitest';
@@
-const { orchestratorMethods } = vi.hoisted(() => {
+const { orchestratorMethods, dbSelect, dbUserPreferencesFindFirst, dbGroupBy } = vi.hoisted(() => {
+  const dbGroupBy = vi.fn(async () => []);
+  const dbWhere = vi.fn(() => ({ groupBy: dbGroupBy }));
+  const dbFrom = vi.fn(() => ({ where: dbWhere }));
+  const dbSelect = vi.fn(() => ({ from: dbFrom }));
+  const dbUserPreferencesFindFirst = vi.fn(async () => ({ monthlyTokenQuota: 100_000 }));
   const orchestratorMethods = {
     recoverInterruptedWork: vi.fn(async () => undefined),
     validateUserFromCookie: vi.fn(),
     chat: vi.fn(),
     createTask: vi.fn(),
     getTask: vi.fn(),
     getTaskSteps: vi.fn(),
+    subscribeToTask: vi.fn(),
     cancelTask: vi.fn(),
     getConversations: vi.fn(),
     getMessages: vi.fn(),
@@
-  return { orchestratorMethods };
+  return { orchestratorMethods, dbSelect, dbUserPreferencesFindFirst, dbGroupBy };
 });
@@
 vi.mock('@pcp/db/src/session', () => ({
   validateSessionUserId: vi.fn(async (sessionId: string) => {
@@
   }),
 }));
+
+vi.mock('@pcp/db/src/client', () => ({
+  db: {
+    select: dbSelect,
+    query: {
+      userPreferences: {
+        findFirst: dbUserPreferencesFindFirst,
+      },
+    },
+  },
+}));
 
 async function buildApp() {
   const { setupAgentRoutes } = await import('./routes');
   const app = Fastify();
   app.setValidatorCompiler(validatorCompiler);
   app.setSerializerCompiler(serializerCompiler);
+  app.setErrorHandler(createApiErrorHandler());
   await app.register(cookie);
   await app.register(setupAgentRoutes);
   return app;
@@
     orchestratorMethods.getTaskSteps.mockResolvedValue([
@@
       },
     ]);
+    orchestratorMethods.subscribeToTask.mockReturnValue({
+      on: vi.fn((event: string, listener: (data: unknown) => void) => {
+        if (event === 'task') {
+          listener({
+            id: TASK_ID,
+            userId: USER_ID,
+            workspaceId: WORKSPACE_ID,
+            status: 'completed',
+            input: 'emitted event',
+            output: 'done',
+            createdAt: new Date('2026-04-27T00:00:00.000Z'),
+            updatedAt: new Date('2026-04-27T00:00:02.000Z'),
+          });
+        }
+      }),
+      off: vi.fn(),
+    });
+    dbGroupBy.mockResolvedValue([]);
+    dbUserPreferencesFindFirst.mockResolvedValue({ monthlyTokenQuota: 100_000 });
   });
@@
   it('does not stream task data when a different user tries to access the event stream', async () => {
@@
     await app.close();
   });
+
+  it('rejects live event streams before subscribing when the task is not owned by the user', async () => {
+    const app = await buildApp();
+
+    orchestratorMethods.getTask.mockResolvedValueOnce(null);
+
+    const response = await app.inject({
+      method: 'GET',
+      url: `/agent/tasks/${TASK_ID}/events`,
+      headers: { cookie: 'sessionId=session-2' },
+    });
+
+    expect(response.statusCode).toBe(404);
+    expect(response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
+    expect(orchestratorMethods.getTask).toHaveBeenCalledWith(TASK_ID, OTHER_USER_ID);
+    expect(orchestratorMethods.subscribeToTask).not.toHaveBeenCalled();
+
+    await app.close();
+  });
 });
```

- [ ] **Step 2: Run the route test and verify the new regression fails**

Run:

```bash
corepack pnpm --filter @pcp/agent-service test -- --run src/routes.test.ts
```

Expected before the route implementation:

- The test file loads without `DATABASE_URL` parsing errors because `@pcp/db/src/client` is mocked.
- The new live event stream regression fails because the route subscribes before checking ownership, or returns `200` instead of `404`.

### Task 3: Fix Agent SSE Ownership And Current-State Streaming

**Files:**
- Modify: `services/agent/src/routes.ts`

- [ ] **Step 1: Implement the minimal route change**

In `services/agent/src/routes.ts`, replace the live push section after the `snapshot` block with this code:

```ts
      const currentTask = await orchestrator.getTask(id, userId);
      if (!currentTask) {
        return sendApiError(reply, 404, 'NOT_FOUND', 'Task not found');
      }

      // Live push: subscribe to in-process task events after proving ownership.
      const emitter = orchestrator.subscribeToTask(id);

      const onTask = (data: unknown): void => {
        sendEvent('task', data);
        const d = data as { status?: string };
        if (d.status && ['completed', 'failed', 'cancelled'].includes(d.status)) {
          cleanup();
          reply.raw.end();
        }
      };
      const onStep = (data: unknown): void => sendEvent('step', data);

      emitter.on('task', onTask);
      emitter.on('step', onStep);

      function cleanup() {
        emitter.off('task', onTask);
        emitter.off('step', onStep);
      }

      sendEvent('task', currentTask);

      if (['completed', 'failed', 'cancelled'].includes(currentTask.status)) {
        cleanup();
        reply.raw.end();
        return reply;
      }

      request.raw.on('close', cleanup);
      return reply;
```

The resulting route must check `orchestrator.getTask(id, userId)` before `orchestrator.subscribeToTask(id)` on non-snapshot SSE requests.

- [ ] **Step 2: Run the focused agent route test**

Run:

```bash
corepack pnpm --filter @pcp/agent-service test -- --run src/routes.test.ts
```

Expected: PASS for all route tests.

- [ ] **Step 3: Commit the agent route fix**

Run:

```bash
git add services/agent/src/routes.test.ts services/agent/src/routes.ts
git commit -m "fix: guard agent task event streams"
```

Expected: one focused commit with only the agent route and route test.

### Task 4: Isolate Agent Env Tests From Caller AUTH_BYPASS

**Files:**
- Modify: `services/agent/src/env.test.ts`

- [ ] **Step 1: Add the env isolation regression**

Patch `services/agent/src/env.test.ts`:

```diff
diff --git a/services/agent/src/env.test.ts b/services/agent/src/env.test.ts
--- a/services/agent/src/env.test.ts
+++ b/services/agent/src/env.test.ts
@@
     process.env.COOKIE_SECRET = 'a'.repeat(32);
     process.env.INTERNAL_SERVICE_TOKEN = 'b'.repeat(32);
+    process.env.AUTH_BYPASS = '0';
     process.env.LLM_PROVIDER = 'openai';
@@
     process.env.COOKIE_SECRET = 'a'.repeat(32);
     process.env.INTERNAL_SERVICE_TOKEN = 'b'.repeat(32);
+    process.env.AUTH_BYPASS = '0';
     process.env.LLM_PROVIDER = 'openai';
@@
     process.env.COOKIE_SECRET = 'a'.repeat(32);
     process.env.INTERNAL_SERVICE_TOKEN = 'b'.repeat(32);
+    process.env.AUTH_BYPASS = '0';
     process.env.LLM_PROVIDER = 'openai';
@@
   it('permits absent ENCRYPTION_KEY in development (or accepts dev-supplied key)', async () => {
     process.env.NODE_ENV = 'development';
+    process.env.AUTH_BYPASS = '0';
     delete process.env.ENCRYPTION_KEY;
@@
     const resolved = mod.env.ENCRYPTION_KEY;
     expect(resolved === undefined || typeof resolved === 'string').toBe(true);
   });
+
+  it('rejects AUTH_BYPASS in production', async () => {
+    process.env.NODE_ENV = 'production';
+    process.env.DATABASE_URL = 'postgres://x:y@localhost/db';
+    process.env.COOKIE_SECRET = 'a'.repeat(32);
+    process.env.INTERNAL_SERVICE_TOKEN = 'b'.repeat(32);
+    process.env.AUTH_BYPASS = '1';
+    process.env.LLM_PROVIDER = 'openai';
+    process.env.OPENAI_API_KEY = 'sk-test-openai-key-1234567890abcdef';
+    process.env.ENCRYPTION_KEY = 'X9k2Ll7vQ8mZpRtY3wN6cF1jB4hG5dKa';
+
+    await expect(import('./env')).rejects.toThrow(/AUTH_BYPASS/);
+  });
 });
```

- [ ] **Step 2: Run the env tests**

Run:

```bash
corepack pnpm --filter @pcp/agent-service test -- --run src/env.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit the env test isolation**

Run:

```bash
git add services/agent/src/env.test.ts
git commit -m "test: isolate agent auth bypass env"
```

Expected: one focused test commit.

### Task 5: Restore Browser Test Isolation And Route Error Mapping

**Files:**
- Modify: `services/browser/vitest.config.ts`
- Modify: `services/browser/src/routes.ts`
- Create: `services/browser/src/routes.test.ts`

- [ ] **Step 1: Write the browser route mapping test**

Create `services/browser/src/routes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { browserRouteErrorCodeFromStatus } from './routes';

describe('browser route error mapping', () => {
  it('preserves client and rate-limit status codes in the shared API envelope', () => {
    expect(browserRouteErrorCodeFromStatus(400)).toEqual({
      statusCode: 400,
      code: 'BAD_REQUEST',
    });
    expect(browserRouteErrorCodeFromStatus(401)).toEqual({
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
    expect(browserRouteErrorCodeFromStatus(403)).toEqual({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
    expect(browserRouteErrorCodeFromStatus(404)).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
    expect(browserRouteErrorCodeFromStatus(409)).toEqual({
      statusCode: 409,
      code: 'CONFLICT',
    });
    expect(browserRouteErrorCodeFromStatus(429)).toEqual({
      statusCode: 429,
      code: 'RATE_LIMITED',
    });
    expect(browserRouteErrorCodeFromStatus(500)).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
    });
  });
});
```

- [ ] **Step 2: Run the browser route mapping test and verify it fails**

Run:

```bash
corepack pnpm --filter @pcp/browser-service test -- --run src/routes.test.ts
```

Expected before implementation: FAIL because `browserRouteErrorCodeFromStatus` is not exported.

- [ ] **Step 3: Implement service-local Vitest config isolation**

Replace `services/browser/vitest.config.ts` with:

```ts
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  css: {
    postcss: {},
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Implement browser route status mapping**

In `services/browser/src/routes.ts`, format the shared import and add this helper above `toJson`:

```ts
import type { ApiErrorCode } from '@pcp/shared';
import {
  browserSessionSchema,
  navigateSchema,
  clickSchema,
  fillSchema,
  sendApiError,
} from '@pcp/shared';

export function browserRouteErrorCodeFromStatus(status: number): {
  statusCode: number;
  code: ApiErrorCode;
} {
  if (status === 400) return { statusCode: 400, code: 'BAD_REQUEST' };
  if (status === 401) return { statusCode: 401, code: 'UNAUTHORIZED' };
  if (status === 403) return { statusCode: 403, code: 'FORBIDDEN' };
  if (status === 404) return { statusCode: 404, code: 'NOT_FOUND' };
  if (status === 409) return { statusCode: 409, code: 'CONFLICT' };
  if (status === 429) return { statusCode: 429, code: 'RATE_LIMITED' };
  return { statusCode: 500, code: 'INTERNAL_ERROR' };
}
```

Then replace the `handle` function body with:

```ts
  function handle(err: any, reply: any, fallback = 'Internal error') {
    const mapped = browserRouteErrorCodeFromStatus(err?.statusCode ?? 500);
    if (mapped.statusCode === 500) fastify.log.error({ err }, 'browser route failed');
    return sendApiError(reply, mapped.statusCode, mapped.code, err?.message ?? fallback);
  }
```

- [ ] **Step 5: Run browser tests and typecheck**

Run:

```bash
corepack pnpm --filter @pcp/browser-service test -- --run src/routes.test.ts src/service.test.ts
corepack pnpm --filter @pcp/browser-service typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the browser slice**

Run:

```bash
git add services/browser/vitest.config.ts services/browser/src/routes.ts services/browser/src/routes.test.ts
git commit -m "fix: preserve browser route error codes"
```

Expected: one browser-service commit.

### Task 6: Clean Up Publish Containers Created During Failed Startup

**Files:**
- Modify: `services/publish/src/service.test.ts`
- Modify: `services/publish/src/service.ts`

- [ ] **Step 1: Write the failing publish cleanup test**

Patch the hoisted test setup in `services/publish/src/service.test.ts`:

```diff
diff --git a/services/publish/src/service.test.ts b/services/publish/src/service.test.ts
--- a/services/publish/src/service.test.ts
+++ b/services/publish/src/service.test.ts
@@
   mockDb,
+  createdContainer,
   createContainer,
@@
 } = vi.hoisted(() => {
-  const createContainer = vi.fn(async () => ({
+  const createdContainer = {
     id: 'container-1',
     start: vi.fn(async () => undefined),
-  }));
+    stop: vi.fn(async () => undefined),
+    remove: vi.fn(async () => undefined),
+  };
+  const createContainer = vi.fn(async () => createdContainer);
@@
     mockDb,
+    createdContainer,
     createContainer,
```

Add this test inside `describe('PublishService security boundaries', () => { ... })` after the existing container launch test:

```ts
  it('removes a created hosted container when startup fails after Docker creation', async () => {
    const { PublishService } = await import('./service');
    createdContainer.start.mockRejectedValueOnce(new Error('start failed'));
    const service = new PublishService();

    await service.startService(SERVICE_ID, USER_ID);

    await waitForExpectation(() =>
      expect(updatedValues).toContainEqual(expect.objectContaining({ status: 'crashed' })),
    );
    expect(createdContainer.stop).toHaveBeenCalled();
    expect(createdContainer.remove).toHaveBeenCalled();
    expect(insertedValueCalls).toContainEqual(
      expect.objectContaining({
        serviceId: SERVICE_ID,
        stream: 'stderr',
        line: 'start failed',
      }),
    );
  });
```

- [ ] **Step 2: Run the publish test and verify it fails**

Run:

```bash
corepack pnpm --filter @pcp/publish-service test -- --run src/service.test.ts
```

Expected before implementation: FAIL because `createdContainer.stop` and `createdContainer.remove` are not called after `start()` rejects.

- [ ] **Step 3: Implement cleanup in `runContainer`**

In `services/publish/src/service.ts`, change `runContainer` to track a created container:

```ts
  private async runContainer(service: HostedServiceRow) {
    let createdContainer: Docker.Container | null = null;
    try {
```

After `const container = await this.docker.createContainer({ ... });`, add:

```ts
      createdContainer = container;
```

After the successful DB update that marks the service `running`, add:

```ts
      createdContainer = null;
```

At the start of the `catch` block, after `const message = ...`, add:

```ts
      if (createdContainer) {
        await cleanupFailedContainer(createdContainer, service.id, this.logger);
      }
```

Add this helper below the `PublishService` class:

```ts
async function cleanupFailedContainer(
  container: Docker.Container,
  serviceId: string,
  logger?: {
    error?: (obj: object, msg?: string) => void;
  },
): Promise<void> {
  try {
    await container.stop();
  } catch {
    // A container that failed before or during start may not be stoppable.
  }

  try {
    await container.remove();
  } catch (err) {
    logger?.error?.(
      {
        err,
        serviceId,
        containerId: container.id,
      },
      'Failed to remove hosted container after startup failure',
    );
  }
}
```

- [ ] **Step 4: Run publish tests and typecheck**

Run:

```bash
corepack pnpm --filter @pcp/publish-service test -- --run src/service.test.ts
corepack pnpm --filter @pcp/publish-service typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the publish slice**

Run:

```bash
git add services/publish/src/service.test.ts services/publish/src/service.ts
git commit -m "fix: clean up failed hosted containers"
```

Expected: one publish-service commit.

### Task 7: Final Verification For The First Slice

**Files:**
- Read: all files touched by Tasks 1-6.

- [ ] **Step 1: Run package verification**

Run:

```bash
corepack pnpm --filter @pcp/agent-service typecheck
corepack pnpm --filter @pcp/agent-service test
corepack pnpm --filter @pcp/browser-service typecheck
corepack pnpm --filter @pcp/browser-service test
corepack pnpm --filter @pcp/publish-service typecheck
corepack pnpm --filter @pcp/publish-service test
```

Expected: all commands pass.

- [ ] **Step 2: Run root verification**

Run:

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
```

Expected: all commands pass. If a command fails, keep the failure output in the implementation notes and fix only files directly related to this plan.

- [ ] **Step 3: Confirm no stale stash application occurred**

Run:

```bash
git status --short --branch
git stash list --date=local | head -5
```

Expected:

- Branch is ahead by the commits from this plan.
- Working tree is clean.
- `stash@{0}: codex-before-pull-2026-05-01` still exists because this plan uses selective recovery, not `stash pop`.

- [ ] **Step 4: Commit verification notes if the report changed**

If `docs/superpowers/reports/2026-05-01-stash-reconciliation.md` was updated with command results during verification, run:

```bash
git add docs/superpowers/reports/2026-05-01-stash-reconciliation.md
git commit -m "docs: update first slice verification"
```

Expected: either no changes, or a docs-only verification commit.
