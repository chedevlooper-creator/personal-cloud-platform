---
status: complete
quick_id: 260501-uiq
slug: ui-ux-pro-max-quality-pass
date: 2026-05-01
---

# Summary

Applied a narrow UI/UX Pro Max quality pass to the chat surface.

## Completed

- Replaced chat attachment preview `<img>` elements with `next/image` using explicit dimensions and `unoptimized` for local/blob-style sources.
- Removed the unused `isLast` prop from `MessageBubble`, clearing the lint warning without changing behavior.
- Raised several chat micro-labels and action labels from arbitrary `10px/11px` sizing to the design-system `text-xs` floor.

## Verification

- `pnpm --filter web lint` passed with no warnings.
- `pnpm --filter web typecheck` passed.
