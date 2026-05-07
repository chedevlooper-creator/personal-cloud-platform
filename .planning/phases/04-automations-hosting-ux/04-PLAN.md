# Phase 4: Automations & Hosting UX — PLAN.md

**Phase:** 4  
**Goal:** Confirm destructive/runtime-impacting actions and expose automation/hosting diagnostics.  
**Requirements:** UX-03, UX-04  
**Status:** Ready for execution

## Tasks

### Task 4.1 — Automations confirm and pending states
**Files:** `apps/web/src/app/(main)/automations/page.tsx`  
**Acceptance Criteria:**
- [ ] Run-now opens confirm dialog before POST `/automations/:id/run`.
- [ ] Delete opens confirm dialog before DELETE `/automations/:id`.
- [ ] Pending state is row-aware where possible.
- [ ] Existing run history modal remains functional.

### Task 4.2 — Hosting env validation
**Files:** `apps/web/src/app/(main)/hosting/page.tsx`  
**Acceptance Criteria:**
- [ ] Invalid env var lines block submit.
- [ ] User sees line-specific errors.
- [ ] Parser keeps existing valid `KEY=value` behavior and quote stripping.

### Task 4.3 — Hosting confirm actions
**Files:** `apps/web/src/app/(main)/hosting/page.tsx`  
**Acceptance Criteria:**
- [ ] Delete, stop, and restart require confirmation.
- [ ] Start remains direct.
- [ ] Existing API calls and invalidation remain unchanged.

### Task 4.4 — Hosting inline detail/log panel
**Files:** `apps/web/src/app/(main)/hosting/page.tsx`, `services/publish/src/routes.ts`, `services/publish/src/service.ts` if needed  
**Acceptance Criteria:**
- [ ] Service card has “Detaylar” toggle.
- [ ] Panel shows kind, workspace, URL, health/crash, auto-restart, update time.
- [ ] Panel shows recent logs if available; otherwise a clear empty state.

### Task 4.5 — Verification
**Acceptance Criteria:**
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes for changed packages.
- [ ] `pnpm lint` passes.

## Verification Commands

```bash
pnpm typecheck
pnpm test
pnpm lint
```

---

*Plan created: 2026-05-07*
