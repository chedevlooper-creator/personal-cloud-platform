# Phase 3: Real Settings Forms — PLAN.md

**Phase:** 3  
**Goal:** Settings panels are real API-backed forms, not local state placeholders, and work on mobile.  
**Requirements:** UX-02  
**Status:** Ready for execution

---

## 1. Overview

### 1.1 Problem
- Profile tab: Name and Bio inputs exist but "Save changes" button is a no-op (no API call).
- Models tab: Static list with hardcoded "Active" on first item, no persistence.
- Workspace tab: Shows static "0 B / 10 GB", not connected to real storage data.
- Danger Zone: Delete Account button has no API integration.
- Mobile: Sidebar navigation is hidden below `md` breakpoint, leaving mobile users with no way to navigate settings tabs.

### 1.2 Solution
Wire all settings forms to real APIs, add missing backend endpoints, and add mobile navigation.

### 1.3 Success Criteria
- [ ] Profile name and bio save via PATCH /user/profile.
- [ ] Model selection persists via PATCH /user/preferences { defaultModel }.
- [ ] Workspace storage shows real usage from GET /workspaces/:id/storage.
- [ ] Account deletion works via DELETE /user/account with confirmation.
- [ ] Mobile navigation works at 375px width (dropdown or horizontal tabs).
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm lint` passes.

---

## 2. Architecture

### 2.1 New Endpoints

```
Auth Service:
  PATCH /user/profile       { name?: string, bio?: string }
  DELETE /user/account      (with cascade soft-delete)

Workspace Service:
  GET /workspaces/:id/storage  { usedBytes: number, totalBytes: number }

Existing Updated:
  PATCH /user/preferences   { terminalRiskLevel?, theme?, defaultModel? }
```

### 2.2 DB Changes
- `userPreferences` table: add `defaultModel text` column (nullable).
- `users` table: already has `name`, no change needed.
- Account deletion: soft delete via `deletedAt` timestamp on `users` row.

---

## 3. Task Breakdown

### Task 3.1 — Add `defaultModel` to `userPreferences` schema
**Files:** `packages/db/src/schema/auth.ts` (or wherever userPreferences is defined)  
**Effort:** small  
**Acceptance Criteria:**
- [ ] `defaultModel` column added to `userPreferences` table (text, nullable).
- [ ] Migration generated and applied.
- [ ] `userPreferencesSchema` and `updateUserPreferencesSchema` in `@pcp/shared` updated.

### Task 3.2 — Add PATCH /user/profile endpoint
**Files:** `services/auth/src/routes/profile.ts`  
**Effort:** small  
**Acceptance Criteria:**
- [ ] New PATCH /user/profile route accepts `{ name?: string, bio?: string }`.
- [ ] Updates `users.name` and/or `userPreferences.bio`.
- [ ] Returns updated profile.
- [ ] Auth via `getUserId` (same as existing routes).

### Task 3.3 — Update settings page profile form
**Files:** `apps/web/src/app/(main)/settings/page.tsx`  
**Effort:** small  
**Acceptance Criteria:**
- [ ] Name and Bio inputs become controlled components.
- [ ] `useMutation` for PATCH /user/profile.
- [ ] "Save changes" button calls mutation.
- [ ] Success/error toasts via `toast`/`toastApiError`.

### Task 3.4 — Update models tab with real API
**Files:** `apps/web/src/app/(main)/settings/page.tsx`  
**Effort:** small  
**Acceptance Criteria:**
- [ ] Models list uses `prefs?.defaultModel` instead of hardcoded index.
- [ ] Clicking a model calls `updatePrefsMutation.mutate({ defaultModel: model })`.
- [ ] Active badge shows on selected model, not just first item.

### Task 3.5 — Add workspace storage endpoint
**Files:** `services/workspace/src/routes.ts`, `services/workspace/src/service.ts`  
**Effort:** medium  
**Acceptance Criteria:**
- [ ] GET /workspaces/:id/storage endpoint added.
- [ ] Calculates total size from S3/MinIO objects under workspace prefix.
- [ ] Returns `{ usedBytes, totalBytes }` (totalBytes = 10GB hardcoded for now).
- [ ] Tenant-scoped: verifies workspace ownership.

### Task 3.6 — Update workspace storage tab
**Files:** `apps/web/src/app/(main)/settings/page.tsx`  
**Effort:** small  
**Acceptance Criteria:**
- [ ] `useQuery` for workspace storage.
- [ ] Progress bar shows real percentage.
- [ ] Display human-readable size (e.g., "1.2 GB / 10 GB").

### Task 3.7 — Add DELETE /user/account endpoint
**Files:** `services/auth/src/routes/profile.ts`  
**Effort:** medium  
**Acceptance Criteria:**
- [ ] DELETE /user/account endpoint added.
- [ ] Soft delete: sets `users.deletedAt = new Date()`.
- [ ] Optionally cascade: set `deletedAt` on workspaces, or let cleanup job handle it.
- [ ] Returns 204 on success.
- [ ] Auth required (same `getUserId`).

### Task 3.8 — Update danger zone with real deletion
**Files:** `apps/web/src/app/(main)/settings/page.tsx`  
**Effort:** small  
**Acceptance Criteria:**
- [ ] Confirmation dialog requires typing "DELETE" to enable confirm button.
- [ ] `useMutation` for DELETE /user/account.
- [ ] On success: clear auth state, redirect to login.
- [ ] Error handling via `toastApiError`.

### Task 3.9 — Add mobile navigation
**Files:** `apps/web/src/app/(main)/settings/page.tsx`  
**Effort:** small  
**Acceptance Criteria:**
- [ ] Mobile (< md): horizontal scrollable tab list or dropdown select.
- [ ] Desktop (>= md): existing sidebar.
- [ ] Active tab highlighted on both mobile and desktop.
- [ ] No horizontal overflow at 375px.

### Task 3.10 — Add tests
**Files:** Various test files  
**Effort:** medium  
**Acceptance Criteria:**
- [ ] Test PATCH /user/profile endpoint.
- [ ] Test DELETE /user/account endpoint.
- [ ] Test GET /workspaces/:id/storage endpoint.
- [ ] Test settings page mutations (frontend unit tests if feasible).

### Task 3.11 — Run full verification suite
**Effort:** small  
**Acceptance Criteria:**
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm lint` passes.
- [ ] Manual mobile check at 375px width.

---

## 4. Implementation Details

### 4.1 Profile Endpoint

```typescript
// services/auth/src/routes/profile.ts
server.patch(
  '/user/profile',
  {
    schema: {
      body: z.object({
        name: z.string().min(1).max(100).optional(),
        bio: z.string().max(500).optional(),
      }),
    },
  },
  async (request, reply) => {
    const userId = await getUserId(request, reply);
    if (!userId) return;

    const { name, bio } = request.body;
    
    if (name !== undefined) {
      await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, userId));
    }
    
    if (bio !== undefined) {
      await db.update(userPreferences)
        .set({ bio, updatedAt: new Date() })
        .where(eq(userPreferences.userId, userId));
    }

    return reply.code(200).send({ success: true });
  },
);
```

### 4.2 Storage Endpoint

```typescript
// services/workspace/src/routes.ts
server.get(
  '/workspaces/:id/storage',
  {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      response: {
        200: z.object({ usedBytes: z.number(), totalBytes: z.number() }),
      },
    },
  },
  async (request, reply) => {
    const userId = await resolveAuthenticatedUserId(request, {
      internalServiceToken: env.INTERNAL_SERVICE_TOKEN,
      allowedAudiences: env.ALLOWED_AUDIENCES,
    });
    if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

    const usage = await workspaceService.getStorageUsage(request.params.id, userId);
    return { usedBytes: usage, totalBytes: 10 * 1024 * 1024 * 1024 }; // 10GB
  },
);
```

### 4.3 Account Deletion Endpoint

```typescript
// services/auth/src/routes/profile.ts
server.delete(
  '/user/account',
  async (request, reply) => {
    const userId = await getUserId(request, reply);
    if (!userId) return;

    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, userId));
    
    // Optionally cascade soft-delete to workspaces
    await db.update(workspaces)
      .set({ deletedAt: new Date() })
      .where(eq(workspaces.userId, userId));

    // Clear session cookie
    reply.clearCookie('sessionId');
    
    return reply.code(204).send();
  },
);
```

### 4.4 Mobile Navigation

```tsx
{/* Mobile tab selector */}
<div className="md:hidden mb-4">
  <select
    value={activeTab}
    onChange={(e) => setActiveTab(e.target.value as SettingsTab)}
    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
  >
    {settingsTabs.map((tab) => (
      <option key={tab.id} value={tab.id}>
        {tab.label}
      </option>
    ))}
  </select>
</div>
```

---

## 5. Testing Strategy

- Backend: Test new endpoints in auth and workspace services.
- Frontend: Test mutation hooks and form submission (if test setup exists).
- Manual: Mobile viewport testing in browser dev tools.

---

## 6. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| DB migration conflicts | Generate migration, test on fresh DB |
| Account deletion irreversible | Soft delete only, no hard delete |
| Storage calculation slow | Cache result or calculate asynchronously |
| Mobile layout breaks | Test at 375px and 768px breakpoints |

---

## 7. Dependencies

- Phase 1 (Error Envelope Hardening) completed — typed errors available.
- Phase 2 (Auth Normalization) completed — audience scoping in place.

---

## 8. Verification

```bash
pnpm typecheck
pnpm test
pnpm lint
```

**Manual verification:**
- [ ] Change profile name → refresh → verify persistence.
- [ ] Select model → refresh → verify persistence.
- [ ] Check storage shows non-zero if files exist.
- [ ] Delete account flow shows confirmation → soft deletes user.
- [ ] Mobile navigation works at 375px.

---

*Plan created: 2026-05-06*  
*Based on: 03-CONTEXT.md, REQUIREMENTS.md (UX-02), ROADMAP.md*
