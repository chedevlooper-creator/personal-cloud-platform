# Phase 4: Automations & Hosting UX - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

## Phase Boundary

Destructive/runtime-impacting actions are confirmed; users can inspect automation run history and hosted-service diagnostics.

Requirements:
- UX-03: Automations confirmation dialogs + real run history view.
- UX-04: Hosting service detail / logs / env validation.

## Implementation Decisions

### Hosting Detail UX
- **D-01:** Use inline expandable panels inside the existing hosting list.
- **D-02:** The panel shows service config, health/crash metadata, public URL, and recent logs.
- **D-03:** Do not add a separate route or side drawer in this phase.

### Env Validation
- **D-04:** Invalid env var lines block deploy/update before the API call.
- **D-05:** Validation is line-aware: missing `=`, empty key, invalid key name are shown to the user.
- **D-06:** Valid lines still parse exactly as before, including quote stripping.

### Confirm Scope
- **D-07:** Confirm delete and run-now in Automations.
- **D-08:** Confirm delete, stop, and restart in Hosting. Start remains direct.
- **D-09:** Add row-level pending state where possible so users know which item is acting.

### Claude's Discretion
- Exact copy for Turkish confirmation text.
- Whether logs are fetched from an existing endpoint or derived from existing service response if no endpoint exists.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Frontend
- `apps/web/src/app/(main)/automations/page.tsx` — Existing automations list, run history modal, run/delete actions.
- `apps/web/src/components/automations/create-automation-dialog.tsx` — Automation creation dialog.
- `apps/web/src/app/(main)/hosting/page.tsx` — Existing hosting list/create form/actions.
- `apps/web/src/components/ui/confirm-dialog.tsx` — Existing confirmation primitive.

### Backend
- `services/agent/src/routes/automation.ts` — Automation CRUD/run/history endpoints.
- `services/publish/src/routes.ts` — Hosted service routes.
- `services/publish/src/service.ts` — Hosted service lifecycle and log persistence.
- `packages/db/src/schema/publish.ts` — Hosted service + log schema.

## Existing Code Insights

### Reusable Assets
- Automations already has `RunHistoryDialog` and `/automations/:id/runs`; improve confirm/pending flow rather than building history from scratch.
- Hosting already uses `ConfirmDialog` for delete; extend the same pattern to stop/restart and details.
- `parseEnvVars` already centralizes env parsing in hosting page; enhance it to return validation errors.

### Established Patterns
- API mutations use TanStack Query and `toastApiError`.
- Turkish UI copy is used throughout.
- Cards are responsive with touch-sized buttons.

### Integration Points
- Hosting service cards should preserve current start/stop/restart/delete API calls.
- If logs endpoint exists, consume it; otherwise expose minimal recent logs from publish service.

## Specific Ideas

- Add `confirmAction` state: `{ type, id, title }` for automations and hosting.
- Add `expandedServiceId` in hosting page for inline details/logs panel.
- Add `validateEnvVars(text)` returning `{ values, errors }` and disable create on errors.

## Deferred Ideas

None.

---

*Phase: 4-Automations & Hosting UX*
*Context gathered: 2026-05-07*
