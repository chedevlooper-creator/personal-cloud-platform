# Phase 7 Context — Cleanup, Docs, Smoke, Mobile, A11y

**Phase:** 7 — Cleanup, Docs, Smoke, Mobile, A11y  
**Date:** 2026-05-08  
**Mode:** Brownfield cleanup sweep; roadmap scope is fixed.

## Domain

Phase 7 closes the remaining v0.1 production-readiness gaps that are individually small but cross-cutting: route layering enforcement, distributed rate-limit backstops, stale docs, frontend smoke coverage, chat state wiring, responsive files/admin pages, and accessible custom controls.

## Decisions

- Prefer small enforcement tests over broad service rewrites unless a route can be moved cleanly without destabilizing behavior.
- Preserve custom events only where they cross disconnected UI trees (`app:attach-file-to-chat`, `app:apply-code-to-workspace`); remove event loops for chat panel toggling/new-chat where provider state is available.
- Keep Phase 7 smoke checks deterministic and runnable in CI without requiring live Docker infrastructure unless explicitly guarded.
- Mobile/responsive fixes should preserve the established Turkish UI style and current design system.
- For rate limiting, prove shared Redis-backed limiter semantics and verify auth/agent use distributed-capable paths rather than replacing every Fastify plugin in one pass.

## Code Context

- `packages/db/src/tenant-isolation-audit.test.ts` already statically inventories direct service DB modules and can be extended with route-layer constraints.
- `services/agent/src/routes.ts`, `services/auth/src/routes/profile.ts`, `services/auth/src/routes/admin.ts`, `services/workspace/src/routes/snapshots.ts`, `services/agent/src/routes/automation.ts`, `services/agent/src/routes/notifications.ts`, and `services/agent/src/routes/channels.ts` currently contain direct DB access in route files.
- `services/runtime/src/policy.ts` and `services/publish/src/policy.ts` duplicate `normalizeProfileValue` for Docker profile env validation.
- `packages/shared/src/rate-limit.ts` implements Redis-capable sliding window rate limiting with in-memory fallback.
- `services/agent/src/rate-limit.ts` uses shared Redis-capable limiter for task/tool/event endpoints.
- `services/auth/src/index.ts` still uses `@fastify/rate-limit` process-local defaults for global/login/register limits.
- `apps/web/src/components/chat/chat-panel-context.tsx` already owns chat panel state, active workspace/conversation, attachments, and new chat behavior.
- `apps/web/src/components/app-shell/keyboard-shortcut-provider.tsx` and `command-palette.tsx` dispatch chat toggle/new-chat events instead of using provider state.
- `apps/web/src/app/(main)/files/page.tsx` hides the file tree on small screens, leaving no mobile file browser.
- `apps/web/src/app/(main)/admin/page.tsx` lacks explicit query error states and uses wide grid rows that can overflow on mobile.
- `scripts/baseline-smoke.mjs` is the current smoke entrypoint.

## Canonical Refs

- `.planning/ROADMAP.md` — Phase 7 scope and success criteria.
- `.planning/REQUIREMENTS.md` — SEC-05, SEC-07, UX-01, UX-05, UX-06, UX-07, INF-01, INF-02, INF-03.
- `packages/db/src/tenant-isolation-audit.test.ts` — current security static audit pattern.
- `packages/shared/src/rate-limit.ts` — shared rate-limit implementation.
- `services/auth/src/index.ts` and `services/auth/src/routes.ts` — auth service rate-limit usage.
- `services/agent/src/rate-limit.ts` and `services/agent/src/routes.ts` — agent service rate-limit usage.
- `apps/web/src/components/chat/chat-panel-context.tsx` — chat provider state.
- `apps/web/src/app/(main)/files/page.tsx` — files page mobile target.
- `apps/web/src/app/(main)/admin/page.tsx` — admin responsive/error-state target.
- `README.md` — docs cleanup target.
- `scripts/baseline-smoke.mjs` — smoke target.

## Deferred Ideas

- Full repository/service layering refactor into repository classes can be a future cleanup milestone; Phase 7 adds enforcement and removes the most visible route DB drift without destabilizing all services.
- True browser-driven Playwright E2E against live services may require seeded credentials and running infra; keep this phase's smoke checks guarded/deterministic.
