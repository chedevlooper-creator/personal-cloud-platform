---
slug: 260501-automations-ui-quality
type: quick
status: planned
created: 2026-05-01
---

# Automations UI Quality Pass

## Goal

Bring the `/automations` page in line with the project design system and automations page override without changing agent-service behavior or data contracts.

## Scope

- Improve responsive layout, card wrapping, tab hit areas, and action controls.
- Localize visible automation actions and run history labels to Turkish.
- Preserve automation list, run-now, pause/resume, webhook copy, delete, and run history behavior.
- Verify with web lint/typecheck and desktop/mobile render checks.

## Out of Scope

- Automation API changes.
- Create automation wizard redesign.
- Schedule parser or human-readable cron implementation beyond safe existing display labels.
