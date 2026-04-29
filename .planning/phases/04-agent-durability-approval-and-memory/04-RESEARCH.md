---
phase: 4
title: Agent Durability, Approval, And Memory Research
created: 2026-04-29
---

# Phase 4 Research

## Existing Implementation Findings

- The orchestrator inserts `tool_calls` rows for tool invocations, but currently
  does not create `approval_requests` rows for approval-required tools.
- Approval-required tools pause the task at `waiting_approval`; approved calls
  are executed from `submitToolApproval`.
- Approval decisions are not time-limited today.
- Audit rows are emitted for executed tools, but not for approval request,
  approval decision, expiry, or restart recovery transitions.
- `runAgentLoop` starts from the original user message every time and does not
  reconstruct prior LLM/tool messages from `task_steps`.
- The safest restart behavior for the current architecture is to mark abandoned
  `executing` or `running` work as failed, while preserving `waiting_approval`
  until the approval expires.
- The LLM provider response includes usage, but the task loop does not aggregate
  usage or persist model/provider metadata yet.
- The memory service exists and tests pass, but production pgvector indexing and
  retrieval documentation should be handled in a dedicated 04-03 slice.

## Implementation Strategy

1. Approval and recovery first:
   - create approval request rows with expiry for high-risk tools
   - scope decisions by user/task/tool call
   - reject expired approvals before side effects
   - write audit rows for request, decision, expiry, and restart recovery
   - add a recovery method that fails abandoned executing/running work instead
     of replaying it silently
2. Streaming and telemetry second:
   - keep polling responses compatible
   - add SSE endpoint or event stream around task steps
   - aggregate LLM usage/latency into `tasks.metadata`
3. Memory third:
   - adopt/verify pgvector index migration intentionally
   - document retrieval/reranking behavior
   - add regression tests for scoped memory search behavior

## Verification Focus

- Unit tests should prove approval rows are created with expiry and linked from
  `tool_calls.approvalId`.
- Approval submission tests should prove expired approvals do not execute tools.
- Recovery tests should prove abandoned side-effectful work is marked failed
  instead of replayed.
- Full agent tests should keep existing task/conversation behavior passing.
