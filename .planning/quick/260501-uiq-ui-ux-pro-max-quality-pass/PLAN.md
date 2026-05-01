---
status: in-progress
quick_id: 260501-uiq
slug: ui-ux-pro-max-quality-pass
date: 2026-05-01
---

# UI/UX Pro Max Quality Pass

Use the project `ui-ux-pro-max` design system to make a narrow, low-risk UI quality pass.

## Scope

- Keep the existing Zihinbulut design system and semantic tokens intact.
- Fix current `web` lint warnings in `chat-core.tsx`.
- Improve small chat UI typography that violates the design-system readable text scale.
- Avoid unrelated redesign or backend/API changes.

## Verification

- `pnpm --filter web lint`
- `pnpm --filter web typecheck`
