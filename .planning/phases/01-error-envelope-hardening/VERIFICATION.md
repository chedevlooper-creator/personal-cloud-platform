# Phase 1 Plan Verification Report

**Phase:** 1 — Error Envelope Hardening  
**Plan reviewed:** `.planning/phases/01-error-envelope-hardening/01-PLAN.md`  
**Context reviewed:** `.planning/phases/01-error-envelope-hardening/01-CONTEXT.md`  
**Requirements:** SEC-01, SEC-02  
**Date:** 2026-05-07

---

## Overall Verdict: NEEDS_REVISION

The plan is well-structured, technically sound, and largely aligned with the locked decisions in `01-CONTEXT.md`. However, **several issues must be resolved before execution** to avoid compilation failures, contradictions with locked decisions, and gaps relative to the ROADMAP success criteria.

---

## Issue Summary

| Severity | Count | Categories |
|----------|-------|------------|
| HIGH | 0 | — |
| MEDIUM | 6 | Locked-decision compliance, type safety, implementation accuracy, infrastructure |
| LOW | 4 | Scope documentation, test organization, frontend verification, task granularity |

---

## MEDIUM Issues (Must Fix Before Execution)

### 1. [MEDIUM] Locked Decision D-03 Violation — Task 1.9 Suggests Replacing `WorkspaceError`

**Location:** Task 1.9 — Update workspace routes to use `DomainError`  
**Problem:** `01-CONTEXT.md` **D-03** locks the decision: *"`WorkspaceError` stays as-is in workspace service (it already works); new services use the shared hierarchy."* Task 1.9’s acceptance criteria says: *"Replace `instanceof WorkspaceError` checks with `instanceof DomainError` (or keep both for backward compat)."* The word "Replace" and the parenthetical create ambiguity and nudge the executor toward removal, which contradicts the locked decision.

**Impact:** Executor may remove `WorkspaceError` handling, breaking existing workspace service behavior.

**Fix:**
```diff
- Replace `instanceof WorkspaceError` checks with `instanceof DomainError` (or keep both for backward compat).
+ Add `instanceof DomainError` checks alongside existing `instanceof WorkspaceError` checks. Do NOT remove WorkspaceError handling.
```

---

### 2. [MEDIUM] Missing Type Infrastructure Updates — `ApiErrorCode` Union and `apiErrorCodeFromStatus`

**Location:** Task 1.1 — Add DomainError hierarchy to `@pcp/shared`  
**Problem:** The plan introduces new canonical codes (`'CONFLICT'`, potentially `'QUOTA_EXCEEDED'`) and new status codes (`409`, `413`) but never mentions updating the existing `ApiErrorCode` union type or the `apiErrorCodeFromStatus(status)` mapping function in `packages/shared/src/errors.ts`. If these utilities do not already map `409`/`413`, route catch blocks that call `apiErrorCodeFromStatus` will return incorrect codes (likely `'INTERNAL_ERROR'`), violating SEC-01.

**Impact:** TypeScript compilation errors or incorrect error envelopes at runtime.

**Fix:** Add an acceptance criterion to Task 1.1:
> - [ ] Audit and update `ApiErrorCode` union type in `packages/shared/src/errors.ts` to include any new codes introduced by subclasses.
> - [ ] Audit and update `apiErrorCodeFromStatus()` to correctly map `409` → `'CONFLICT'`, `413` → `'QUOTA_EXCEEDED'` (or chosen code).

---

### 3. [MEDIUM] Ambiguous `QuotaExceededError` Code Breaks Contract

**Location:** Section 4.1 — DomainError Class Design  
**Problem:** The implementation snippet assigns `readonly code: ApiErrorCode = 'BAD_REQUEST'; // or new QUOTA_EXCEEDED code`. This is an unresolved design ambiguity left in the plan. A deferred decision during execution risks breaking type contracts or producing inconsistent envelopes.

**Impact:** Type errors, inconsistent API contract, potential frontend mismatch.

**Fix:** Decide the code now (per CONTEXT.md discretion). Recommendation: add `'QUOTA_EXCEEDED'` to `ApiErrorCode` and use it. Update Section 4.1 to remove the comment and show the final code.

---

### 4. [MEDIUM] Repository Wrapping Example Contains Invalid / Dangerous Pattern

**Location:** Section 4.2 — Repository Layer Wrapping  
**Problem:** The example shows:
```typescript
} catch (error) {
  if (error instanceof DomainError) throw error;
  throw new DomainError('Database error'); // Or let it bubble to 500
}
```
This is invalid (`DomainError` is abstract and cannot be instantiated) and advocates a blanket catch-all that would silently wrap genuine 500-level driver failures (e.g., connection drops) as generic `DomainError`s, potentially misclassifying them as 4xx.

**Impact:** Executor may copy the example literally, causing compilation failure and incorrect error classification.

**Fix:** Replace the example with a pattern that:
1. Only catches specific, known driver error codes (e.g., `error.code === 'ECONNREFUSED'`).
2. Either wraps them into the appropriate concrete subclass or rethrows to let the global 500 handler catch them.
3. Never instantiates the abstract `DomainError` directly.

---

### 5. [MEDIUM] Browser Route Implementation Inconsistent with Acceptance Criteria

**Location:** Task 1.6 AC vs. Section 4.5  
**Problem:** Task 1.6 AC requires: *"`handle()` helper checks `mapped.statusCode >= 500`."* Section 4.5 implementation shows:
```typescript
if (mapped.statusCode === 500) {
```
This will fail to catch `502`, `503`, `504`, etc., leaking raw messages for non-500 5xx errors.

**Impact:** SEC-02 violation for non-500 server errors.

**Fix:** Update Section 4.5 to use `>= 500`:
```typescript
if (mapped.statusCode >= 500) {
```

---

### 6. [MEDIUM] `packages/shared` Test Infrastructure Not Addressed

**Location:** Task 1.2 — Add domain error tests for `@pcp/shared`  
**Problem:** `AGENTS.md` explicitly states: *"`apps/web` and `packages/shared` have no tests."* Adding `packages/shared/src/errors.test.ts` requires a `test` script in `packages/shared/package.json` so that `pnpm test` or `pnpm --filter @pcp/shared test` can execute it. The plan does not mention adding this script.

**Impact:** Tests may be written but never run in CI or locally.

**Fix:** Add to Task 1.2 files: `packages/shared/package.json` and an AC:
> - [ ] Add `"test": "vitest run"` (or appropriate command) to `packages/shared/package.json` scripts.

---

## LOW Issues (Should Fix Before Execution)

### 7. [LOW] ROADMAP Success Criteria Gap — Auth and Memory Services Not Verified

**Location:** Phase-level scope  
**Problem:** `ROADMAP.md` Phase 1 success criteria states:
> - "A `DomainError` (or equivalent) hierarchy exists in `@pcp/shared` and is **used by all 7 services**."
> - "Tests cover at least one error path **per service** that confirms the public envelope."

The plan (consistent with `01-CONTEXT.md` D-06) explicitly excludes **auth** and **memory** services, covering only 5 services. While CONTEXT.md justifies this ("already handle errors correctly"), the plan does not explicitly document this deviation from ROADMAP, nor does it verify that auth/memory already meet the criteria.

**Fix:** Add a note in Section 1.3 or Section 7:
> "Auth and memory services are out of scope for this phase per D-06. They already use `sendApiError` correctly and do not throw plain `Error` for 4xx cases. Verification deferred to Phase 7 cleanup."

*(Alternatively, add a single lightweight task to grep/auth/memory for plain `throw new Error` used for client errors to confirm they are clean.)*

---

### 8. [LOW] Task 1.8 Scope — Large Task Covering 5 Services

**Location:** Task 1.8 — Add service-level error envelope tests  
**Problem:** One task creates/extends tests across 5 independent services. Effort is "large". This reduces granularity and makes it harder to track partial progress or parallelize.

**Fix:** Consider splitting into 5 sub-tasks (1.8a–1.8e) or at least list per-service ACs explicitly so the executor can tick them off independently.

---

### 9. [LOW] Inconsistent Test File Path for Datasets

**Location:** Task 1.7 vs. Task 1.8 file lists  
**Problem:** Task 1.7 places the route at `services/workspace/src/routes/datasets.ts`. Task 1.8 places the test at `services/workspace/src/datasets/error-envelope.test.ts`. The directory structures do not align (`routes/datasets.ts` vs. `datasets/error-envelope.test.ts`).

**Fix:** Align the test path with the source path convention, e.g.:
> `services/workspace/src/routes/datasets.test.ts` or `services/workspace/src/routes/datasets/error-envelope.test.ts`

---

### 10. [LOW] No Frontend Verification Step for `toastApiError`

**Location:** Success Criteria / Section 8  
**Problem:** ROADMAP success criteria: *"Existing `toastApiError` consumer remains the single frontend sink and renders new envelopes."* The plan asserts *"no frontend changes needed"* and *"toastApiError already handles the envelope"*, but there is no acceptance criterion or manual verification step that actually exercises the frontend.

**Fix:** Add a manual verification item to Section 8:
> - [ ] Open the web app, trigger a 404/409 error via the UI, and confirm `toastApiError` displays the correct code and message (not a raw stack trace).

---

## Strengths of the Plan

1. **Clear problem statement** and well-defined success criteria.
2. **Excellent risk table** — `instanceof` across packages, WorkspaceError conflict, vitest version split are all identified and mitigated.
3. **Architecture section** (Section 2) clearly explains the error flow and safety net.
4. **Context compliance** — Respects D-01, D-02, D-04, D-05, D-06, D-07, D-08 (except D-03 as noted above).
5. **Rollback plan** is simple and safe (no DB changes).
6. **Testing strategy** covers both unit and integration levels.

---

## Recommendation

**Do NOT execute the plan until the 6 MEDIUM issues are resolved.** The most critical fixes are:

1. **Task 1.9 wording** — prevent accidental removal of `WorkspaceError`.
2. **Task 1.1 type infrastructure** — ensure `ApiErrorCode` and `apiErrorCodeFromStatus` support new codes.
3. **Section 4.2 example** — remove invalid abstract-class instantiation and blanket catch.
4. **Section 4.5 `>= 500`** — fix the browser route snippet to match AC.

Once these are addressed, the plan is ready for execution.

---

*Verifier: gsd-plan-checker*  
*Next step: Revise 01-PLAN.md and re-run verification.*
