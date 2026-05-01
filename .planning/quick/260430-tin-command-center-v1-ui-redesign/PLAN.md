---
status: in-progress
quick_id: 260430-tin
slug: command-center-v1-ui-redesign
date: 2026-04-30
---

# Command Center V1 UI Redesign

Implement the accepted Zihinbulut Command Center V1 plan for `apps/web`.

## Scope

- Keep Zihinbulut Turkish product language.
- Preserve existing backend/API contracts.
- Improve app shell route metadata, sidebar structure, dashboard command-center layout, mobile touch targets, workspace mobile layout, and delete confirmation UX.

## Verification

- `pnpm --filter web typecheck`
- `pnpm --filter web lint`
- `pnpm --filter web build`
- Browser QA for login, dashboard, computer, automations, hosting, and workspace mobile/desktop routes.
