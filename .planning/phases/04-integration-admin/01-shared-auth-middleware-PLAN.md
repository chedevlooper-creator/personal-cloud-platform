---
phase: 4
plan: 01
name: shared-auth-middleware
objective: Extract duplicated session validation into a shared auth package used by all services
gap_closure: false
autonomous: true
wave: 1
cross_ai: false
files_modified:
  - packages/shared/src/auth.ts
  - services/auth/src/routes.ts
  - services/workspace/src/routes.ts
  - services/runtime/src/routes.ts
  - services/agent/src/routes.ts
  - services/memory/src/routes.ts
  - services/publish/src/routes.ts
  - services/browser/src/routes.ts
---

# Plan 04-01: Shared Auth Middleware

## Objective

Every service currently duplicates cookie session validation using direct DB reads. Extract this into a reusable `@pcp/shared` auth module so all services validate sessions consistently without duplicating logic or importing `@pcp/db` internals directly.

## Background

From `AGENTS.md`:
> Cookie session validation is duplicated across services using direct DB reads.

Current pattern (seen in auth, workspace, agent, etc.):
```ts
async function getAuthenticatedUserId(sessionId: string | undefined): Promise<string | null> {
  if (env.AUTH_BYPASS) return 'local-dev-user';
  if (!sessionId) return null;
  return validateSessionUserId(sessionId); // direct DB read
}
```

This is copy-pasted in 6+ services and couples routes to `@pcp/db/src/session`.

## Tasks

### Task 1: Create shared auth middleware (1.5h)

Create `packages/shared/src/auth.ts`:

```ts
import { validateSessionUserId } from '@pcp/db/src/session';

export interface AuthOptions {
  authBypass?: boolean;
  bypassUserId?: string;
}

export async function resolveUserIdFromSession(
  sessionId: string | undefined,
  options: AuthOptions = {},
): Promise<string | null> {
  if (options.authBypass) {
    return options.bypassUserId ?? 'local-dev-user';
  }
  if (!sessionId) return null;
  return validateSessionUserId(sessionId);
}

export function createAuthMiddleware(options: AuthOptions) {
  return async function getUserId(sessionId: string | undefined): Promise<string | null> {
    return resolveUserIdFromSession(sessionId, options);
  };
}
```

Export from `packages/shared/src/index.ts`.

### Task 2: Refactor services to use shared auth (1.5h)

Replace inline `getAuthenticatedUserId` in each service with the shared version:

- [ ] `services/auth/src/routes.ts`
- [ ] `services/workspace/src/routes.ts`
- [ ] `services/runtime/src/routes.ts`
- [ ] `services/agent/src/routes.ts`
- [ ] `services/memory/src/routes.ts`
- [ ] `services/publish/src/routes.ts`
- [ ] `services/browser/src/routes.ts`

Pattern:
```ts
import { createAuthMiddleware } from '@pcp/shared';

const getAuthenticatedUserId = createAuthMiddleware({
  authBypass: env.AUTH_BYPASS,
});
```

### Task 3: Add internal service token validation helper (0.5h)

Also in `packages/shared/src/auth.ts`:

```ts
export function verifyInternalServiceToken(
  token: string | undefined,
  expectedToken: string,
): boolean {
  if (!token || !expectedToken) return false;
  return token === `Bearer ${expectedToken}`;
}
```

Update `services/*/src/clients/http.ts` to use this.

### Task 4: Typecheck + smoke test (0.5h)

```bash
pnpm typecheck
```

Verify no TypeScript errors from the refactor.

## Success Criteria

- [ ] `packages/shared/src/auth.ts` exists and exports `createAuthMiddleware` + `verifyInternalServiceToken`
- [ ] All 7 services use the shared auth middleware (no inline session validation)
- [ ] `pnpm typecheck` passes
- [ ] No functional changes — auth behavior identical to before

## Deviations

If a service has unique auth logic (e.g., webhook routes without cookies), keep that local and document in the service's route file.

## Notes

- Keep changes minimal — this is a refactor, not a redesign
- Do NOT change `validateSessionUserId` implementation in `@pcp/db`
- Do NOT change env validation logic
- Goal: eliminate duplication, not change behavior
