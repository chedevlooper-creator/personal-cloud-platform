---
phase: 4
plan: 04-01
subsystem: agent durability
tags:
  - approvals
  - recovery
  - audit
requires:
  - 03-03
provides:
  - expiring-tool-approvals
  - approval-request-audit
  - interrupted-work-recovery
affects:
  - services/agent/src/orchestrator.ts
  - services/agent/src/orchestrator.test.ts
  - services/agent/src/routes.ts
key-files:
  created: []
  modified:
    - services/agent/src/orchestrator.ts
    - services/agent/src/orchestrator.test.ts
    - services/agent/src/routes.ts
key-decisions:
  - Use existing `approval_requests` and `tool_calls` tables instead of adding schema.
  - Treat interrupted executing work as failed on startup to avoid silent replay of side effects.
  - Enforce approval expiry before executing any approved high-risk tool.
requirements-completed:
  - AGT-01
  - AGT-02
  - TST-01
duration: 0.4h
completed: 2026-04-29
---

# Phase 4 Plan 04-01: Harden Tool Approval And Task Recovery Semantics Summary

Approval-required tool calls are now durable, expiring, scoped, and audited.
Interrupted agent work now fails explicitly instead of being silently replayed.

## What Changed

- Approval-required tools now create linked `approval_requests` rows with
  `expiresAt`.
- `tool_calls.approvalId` is populated after approval request creation.
- Approval submission now scopes pending calls by `taskId`, `userId`, and
  `awaiting_approval` status.
- Expired approvals:
  - do not execute tools
  - mark the approval decision as `expired`
  - mark the tool call `timeout`
  - mark the task failed with an explicit output
  - emit `TOOL_APPROVAL_EXPIRED`
- Approval decisions emit `TOOL_APPROVAL_DECIDED`.
- Approval requests emit `TOOL_APPROVAL_REQUESTED`.
- Approved/rejected tool calls now record completed/failed/rejected state,
  result/error, duration, and `completedAt`.
- Agent route setup invokes `recoverInterruptedWork()`.
- Recovery marks abandoned `executing` tasks and `running` tool calls failed,
  emitting `AGENT_TASK_RECOVERED_FAILED` and `TOOL_CALL_RECOVERED_FAILED`.

## Verification

- RED confirmed:
  - Approval request test failed before `approval_requests` creation existed.
  - Expired approval test failed because old code executed approvals without
    expiry checks.
  - Recovery test failed because `recoverInterruptedWork` did not exist.
- GREEN confirmed:
  - `pnpm --filter @pcp/agent-service test -- src/orchestrator.test.ts` passed.
  - `pnpm --filter @pcp/agent-service test` passed.
  - `pnpm --filter @pcp/agent-service typecheck` passed.
  - `pnpm test` passed.
  - `pnpm typecheck` passed.

## Deviations from Plan

- `pnpm lint` still fails on pre-existing `apps/web` React lint errors outside
  this agent-service plan.
- Existing dirty memory migration/service files remain outside this plan and
  were not staged.

**Total deviations:** 2 known scope/verification deviations.
**Impact:** 04-01 agent approval/recovery behavior is verified; unrelated
frontend lint and memory work remain separate.

## Next

Ready for 04-02: add agent streaming and token telemetry.
