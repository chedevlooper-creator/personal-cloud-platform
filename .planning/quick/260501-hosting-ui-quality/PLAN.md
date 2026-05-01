---
slug: 260501-hosting-ui-quality
type: quick
status: planned
created: 2026-05-01
---

# Hosting UI Quality Pass

## Goal

Bring the `/hosting` page in line with the project design system and hosting page override without changing publish-service behavior or data contracts.

## Scope

- Improve responsive page layout, mobile wrapping, and action hit areas.
- Use existing UI primitives and semantic design tokens.
- Keep service creation, start/stop/restart, auto-restart, open, and delete behavior unchanged.
- Verify with web lint/typecheck and desktop/mobile render checks.

## Out of Scope

- Publish service API changes.
- Hosting detail tabs, logs, metrics, or deploy wizard implementation.
- Database or backend changes.
