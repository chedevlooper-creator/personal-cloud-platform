# Phase 3: Real Settings Forms - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

## Phase Boundary

Settings panels are real API-backed forms, not local state placeholders, and work on mobile. Specifically:
- UX-02: Settings panels are real API-backed forms with mobile layout.

Scope: Frontend settings page + supporting backend endpoints.

## Implementation Decisions

### Profile Form Wiring
- **D-01:** New PATCH /user/profile endpoint for name and bio updates.
- **D-02:** Name stored in `users` table, bio in `userPreferences` table.
- **D-03:** Separate endpoint keeps profile and preferences as distinct concerns.

### Models Tab Real Data
- **D-04:** Add `defaultModel` column to `userPreferences` table (string, nullable).
- **D-05:** Update GET /user/preferences and PATCH /user/preferences to include `defaultModel`.
- **D-06:** Frontend models tab becomes dynamic with real API integration.

### Workspace Storage Calculation
- **D-07:** Add GET /workspaces/:id/storage endpoint in workspace service.
- **D-08:** Calculate total size from S3/MinIO objects under workspace prefix.
- **D-09:** Frontend shows real storage usage instead of static placeholder.

### Danger Zone Account Deletion
- **D-10:** Add DELETE /user/account endpoint in auth service.
- **D-11:** Soft delete approach: set `deletedAt` on user row (cascade to related data or handle in cleanup job).
- **D-12:** UI adds "type DELETE to confirm" pattern before API call.

### Mobile Layout
- **D-13:** Add mobile tab navigation (dropdown or horizontal scroll) since sidebar is `hidden md:block`.
- **D-14:** Ensure all form elements are usable at 375px width.

### Claude's Discretion
- Exact cascade behavior for account deletion (soft vs hard delete).
- Mobile navigation pattern (dropdown vs bottom sheet vs horizontal tabs).
- Storage calculation frequency (real-time vs cached).

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Settings Page
- `apps/web/src/app/(main)/settings/page.tsx` — Current settings page with static/no-op forms

### Auth Service Endpoints
- `services/auth/src/routes/profile.ts` — Existing /user/preferences and /user/providers endpoints

### Workspace Service
- `services/workspace/src/service.ts` — WorkspaceService for storage calculation
- `services/workspace/src/routes.ts` — Route setup patterns

### DB Schema
- `packages/db/src/schema/*` — userPreferences, users, providerCredentials tables

## Existing Code Insights

### Reusable Assets
- `useMutation` + `useQuery` patterns from TanStack Query already used in settings page.
- `authApi` from `@/lib/api` already configured with interceptors.
- `toast` from sonner already used for success/error feedback.
- `ConfirmDialog` component exists for confirmation dialogs.

### Established Patterns
- Form validation via Zod schemas in `@pcp/shared`.
- API error handling via `toastApiError`.
- Route auth via `resolveAuthenticatedUserId`.

### Integration Points
- New /user/profile endpoint fits alongside existing /user/preferences in auth service.
- Storage endpoint needs S3/MinIO client access (already in workspace service).
- Account deletion needs careful cascade handling across multiple tables.

## Specific Ideas

- Profile form: controlled inputs with useState, onSubmit calls mutation, onSuccess invalidates user query.
- Models: radio group pattern similar to terminal policy selection.
- Storage: progress bar with actual percentage.
- Account deletion: input field that requires typing "DELETE" before button enables.

## Deferred Ideas

None — all identified issues are within phase scope.

---

*Phase: 3-Real Settings Forms*
*Context gathered: 2026-05-06*
