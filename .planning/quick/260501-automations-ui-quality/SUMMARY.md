---
slug: 260501-automations-ui-quality
status: complete
completed: 2026-05-01
---

# Automations UI Quality Pass Summary

## Completed

- Reworked `/automations` header, tabs, cards, action controls, error state, and run history dialog for responsive layout.
- Standardized page controls around existing UI primitives, semantic tokens, visible focus states, and 44px touch targets.
- Localized visible list, action menu, toast, and run history text to Turkish.
- Hid raw cron expressions on automation cards by using a safer "Özel zamanlama" label.
- Kept agent-service data flow and automation behavior unchanged.

## Verification

- `corepack pnpm --filter web lint`
- `corepack pnpm --filter web typecheck`
- `corepack pnpm typecheck`
- Playwright render smoke at 1440x1000 and 390x900 with mocked automation data:
  - active, paused, and run-history states render
  - `overflowX: 0`
  - `chatOverlayOpen: false`
  - `undersized: []`
