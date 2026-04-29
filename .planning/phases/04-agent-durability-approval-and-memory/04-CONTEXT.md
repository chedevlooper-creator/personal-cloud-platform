---
phase: 4
title: Agent Durability, Approval, And Memory
status: ready-for-planning
created: 2026-04-29
---

# Phase 4: Agent Durability, Approval, And Memory - Context

## Phase Boundary

Make the existing agent service safer and more production-ready without
rewriting the product architecture. This phase focuses on approval semantics,
task recovery, streaming/telemetry, and memory retrieval.

## Current Shape

- `services/agent/src/orchestrator.ts` owns task creation, LLM loop execution,
  tool approval handling, and best-effort memory persistence.
- Tool metadata lives in `services/agent/src/tools/*`.
- `packages/db/src/schema/tool_calls.ts` already has `tool_calls` and
  `approval_requests` tables, but approval requests are not yet used by the
  orchestrator.
- `tasks.metadata` is the existing place for provider/model/token/latency/cost
  style run metadata.
- Memory service and DB schema already exist; pgvector migration/index work is
  partially present in the working tree but not owned by this phase until 04-03.

## Decisions

- Preserve the independent Fastify service shape. Do not introduce an API
  gateway or a separate agent worker process in this phase.
- Use existing DB tables before adding schema. `approval_requests`,
  `tool_calls`, `tasks`, and `task_steps` are sufficient for the 04-01 slice.
- For restart safety, prefer explicit failure/retry semantics over silently
  replaying side-effectful tool calls.
- Keep user-facing approval state pollable through existing task/task-step APIs
  before adding streaming in 04-02.
- Keep memory improvements scoped to index/retrieval behavior and docs; do not
  replace pgvector.

## Canonical References

- `.planning/ROADMAP.md` - Phase 4 goals and success criteria.
- `.planning/REQUIREMENTS.md` - AGT-01, AGT-02, AGT-03, AGT-04, MEM-01.
- `services/agent/src/orchestrator.ts` - core agent task loop and approvals.
- `services/agent/src/tools/registry.ts` - approval enforcement boundary.
- `packages/db/src/schema/tool_calls.ts` - tool call and approval request schema.
- `packages/db/src/schema/tasks.ts` - task status and metadata schema.
- `services/memory/src/service.ts` - memory search behavior.

## Risks

- Resuming an LLM loop from partial `task_steps` is non-trivial because the
  current loop does not reconstruct provider messages from DB state.
- Replaying a side-effectful approved tool call after restart can duplicate work.
- Frontend currently relies on polling; streaming changes should not break the
  polling contract.
- Existing unrelated memory migration files are dirty in the worktree and must
  be treated as out-of-scope unless 04-03 explicitly adopts them.

## Done Means

- High-risk tools have durable, expiring approval requests and auditable
  decisions.
- Interrupted tasks/tool calls recover or fail explicitly without silent loss or
  duplicate side effects.
- Task progress can stream to clients while polling remains compatible.
- Agent runs persist provider/model/token/latency metadata.
- Memory search has a documented pgvector index and retrieval strategy.
