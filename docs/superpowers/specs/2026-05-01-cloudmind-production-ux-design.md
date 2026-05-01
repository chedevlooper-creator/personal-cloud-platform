# CloudMind OS Production and UX Design

Date: 2026-05-01

## Context

CloudMind OS is a personal AI cloud computer. It gives each user persistent
workspaces, files, terminal access, an AI agent with tool calling, browser
sessions, automations, hosted apps, snapshots, memory, datasets, settings, and
admin surfaces through a Next.js frontend backed by independent Fastify
services.

The current source describes a working brownfield platform, not a greenfield
prototype. The repository is a pnpm monorepo with:

- `apps/web` for the Next.js 16 and React 19 app shell.
- `services/auth`, `workspace`, `runtime`, `agent`, `memory`, `publish`, and
  `browser` as independent Fastify services.
- `packages/db` as the sole Drizzle schema and migration owner.
- `packages/shared` for Zod DTOs imported directly from source.

The live checkout is clean on `master`. Prior Codex work exists in
`stash@{0}: codex-before-pull-2026-05-01`; it must be inspected and integrated
selectively rather than applied wholesale.

## Product Goal

Move CloudMind OS toward a production-ready, understandable personal AI cloud
computer. The user should immediately understand that Workspace, Chat,
Terminal, Browser, Hosting, Automations, Memory, and Settings are parts of one
operating environment, while the backend enforces tenant isolation, safe
execution, predictable errors, and verifiable service boundaries.

This is a combined production and UX effort. Security and reliability work
should land alongside visible user-flow improvements so the product becomes
safer and easier to use at the same time.

## Approaches Considered

### Option A: Production-first

Focus first on auth/session handling, tenant isolation, global error envelopes,
env validation, sandboxing, CI, and observability. This lowers technical risk
quickly, but leaves the product experience scattered for longer.

### Option B: UX-first

Focus first on dashboard, chat, workspace, computer, terminal, browser, and
hosting flows. This makes progress visible quickly, but can increase risk if
security and service correctness stay uneven under the UI.

### Option C: Mixed phases

Pair production hardening with user-flow improvements in each phase. This is
the selected approach because the product is both a cloud-computer security
system and a user-facing operating environment. Each phase should leave the
system safer, more coherent, and easier to verify.

## Selected Design

### Phase 0: Source and Stash Reconciliation

Start from the current clean `master` checkout. Inspect the prior stash before
making code changes:

- Identify fixes already present upstream.
- Identify fixes still needed.
- Identify obsolete or conflicting changes that should stay out.
- Recover only the useful slices, preferably file-by-file or hunk-by-hunk.

No stash pop should be used for this phase. If applying is useful, use
non-destructive `git stash apply` only after reviewing the diff and with a plan
for conflicts.

### Phase 1: Reliable Product Foundation

Close production blockers that affect every user-facing flow:

- Shared API error envelope and canonical error codes.
- Consistent auth/session validation patterns.
- Tenant-scoped service behavior and tests for high-risk routes.
- Zod env validation and production guards.
- CI-quality verification commands.

UX work paired with this phase:

- Make service errors visible as consistent, understandable UI states.
- Tighten loading, empty, and failure states in the app shell and key pages.
- Keep Turkish UI text consistent where the current app already uses Turkish.

### Phase 2: Agent and Workspace Experience

Make the agent feel like a reliable operator inside the cloud computer:

- Durable task lifecycle: create, stream, approve, cancel, resume, and complete.
- Approval requests with accurate status transitions and expiry behavior.
- Step history that reflects real execution order.
- Workspace context carried consistently through chat and tool calls.

UX work paired with this phase:

- Chat panel, tool approval cards, conversation list, and workspace context bar
  should read as one coherent workflow.
- Users should know what the agent is doing, what needs approval, and what
  happened after approval or cancellation.

### Phase 3: Runtime, Browser, and Hosting Hardening

Strengthen the execution and publishing surface:

- Runtime sandbox defaults, command limits, and auditability.
- Browser session isolation and safe navigation behavior.
- Publish service container lifecycle cleanup and restart behavior.
- Logs, status transitions, and failure recovery for running services.

UX work paired with this phase:

- Computer, Terminal, Browser, and Hosting pages should show live status,
  recoverable errors, retry paths, and safe destructive actions.

### Phase 4: Release Readiness

Prepare the project for repeatable setup and external use:

- Accessibility pass for dialogs, focus, keyboard use, and contrast.
- Frontend smoke coverage for critical flows.
- Production checklist aligned with executable config.
- Deploy documentation that avoids stale paths and service names.

## First Implementation Slice

The first implementation slice is Phase 0 plus the first part of Phase 1:

1. Inspect `stash@{0}` against current `master`.
2. Classify prior fixes as already upstream, still needed, or obsolete.
3. Reintegrate only still-needed fixes.
4. Start the production foundation with the shared API error envelope and
   canonical error-code usage, because earlier review findings pointed at this
   exact seam and it improves both backend correctness and frontend handling.

## Component Boundaries

- Shared API contracts belong in `packages/shared/src`.
- Database schema and migrations remain in `packages/db`.
- Service routes own HTTP validation and response mapping.
- Service logic owns business rules and should not leak raw internal errors.
- Frontend API clients normalize backend errors for UI components.
- UI pages should remain focused on workflows, while reusable status, empty,
  error, and approval states live in components.

## Data Flow

For normal user workflows:

1. The web app authenticates through the auth service using session cookies.
2. Feature pages call the owning service directly.
3. Services validate input, derive the user from the session, and enforce
   `user_id` or `workspace_id` filters.
4. Cross-service calls use the existing internal service token pattern.
5. Agent tasks persist task, step, tool-call, and approval state in Postgres.
6. Runtime, browser, and publish services expose state back to the UI through
   service routes.

For the first slice, data flow changes should stay narrow: normalize error
responses and preserve existing route behavior unless a route is already known
to be incorrect.

## Error Handling

The target error model is:

- Shared canonical error codes.
- One consistent response envelope for public API failures.
- Fastify error handlers per service that map validation, auth, tenant, rate
  limit, not-found, conflict, and internal failures without leaking internals.
- Frontend handling that can show useful messages without parsing ad-hoc
  `{ error: string }` shapes.

The first slice should not attempt to convert every route in one pass. It
should establish the shared shape, migrate a small representative surface, and
add tests that make the contract hard to regress.

## Testing and Verification

Each phase should end with targeted and broad verification:

- Package typecheck for every touched service or app.
- Package tests for every touched service.
- Root `corepack pnpm typecheck`, `corepack pnpm lint`, and
  `corepack pnpm test` when changes affect shared contracts or multiple
  packages.
- Focused regression tests for tenant isolation, auth boundaries, task state,
  tool approvals, sandbox behavior, and API error shapes.

For frontend UX changes, verify with the app running when practical and inspect
the actual page state rather than relying only on static review.

## Out of Scope

- Replacing Docker with Firecracker or Kata in the first pass.
- Rewriting all services around a new framework.
- Applying the full stash blindly.
- Large visual redesign before the production and workflow boundaries are
  stable.
- Adding new major product modules before the existing cloud-computer loop is
  reliable.

## Success Criteria

- The source tree remains clean and understandable after stash reconciliation.
- Production blockers are reduced through small, verifiable vertical slices.
- The app communicates failures, approvals, running state, and workspace context
  clearly to the user.
- Tenant isolation and session-derived identity remain non-negotiable.
- Verification commands pass for each completed slice.
