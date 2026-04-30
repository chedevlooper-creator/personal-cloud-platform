# Agent Service Critical Fixes — Phase 1

## Goal
Fix three critical bugs in `services/agent/src/orchestrator.ts` that break agent reliability and correctness.

## Issues

### 1. Multi-Tool Execution Ignored (P0)
**Problem:** `runAgentLoop` only processes `response.toolCalls[0]`. When the LLM returns multiple tool calls (e.g., `read_file` + `write_file`), the rest are silently dropped.

**Root cause:** `orchestrator.ts:514` — `const toolCall = response.toolCalls[0]`.

**Expected:** Loop through all tool calls, executing them sequentially, building a composite observation message.

**Risks:**
- Composite tool output must fit context window
- Sequential execution order matters
- Approval-required tools must still pause the loop

### 2. Automation Worker Fake Completion (P0)
**Problem:** `automation/queue.ts` marks automation runs as `completed` immediately after `orchestrator.createTask()` returns, but the task runs asynchronously and may take minutes.

**Root cause:** `queue.ts:49` — no task completion polling or event listening.

**Expected:** Poll the task status or use task events to determine real completion before updating `automationRuns`.

**Risks:**
- Polling adds latency but is simplest
- Must respect max automation timeout

### 3. Unsafe Tool Input Parsing (P1)
**Problem:** `registry.execute()` and `registry.executeApproved()` call `JSON.parse(inputStr)` without `try/catch`. Invalid JSON from a misbehaving LLM throws an unhandled error.

**Root cause:** `tools/registry.ts:55` and `:73`.

**Expected:** Wrap `JSON.parse` in `try/catch`, return a structured error that the agent loop can feed back as an observation.

**Risks:**
- Must not break existing valid tool flows

## Implementation Plan

1. **Multi-tool execution**
   - Refactor tool-call handling block into a `for...of` loop over `response.toolCalls`
   - Accumulate tool outputs into a single observation message
   - If any tool requires approval, pause immediately (current behavior)
   - Insert a single `observation` step with combined output

2. **Automation worker**
   - After `createTask`, poll `orchestrator.getTask()` every 3s
   - Wait for `completed`, `failed`, or `cancelled`
   - Update `automationRuns` with real output/error
   - Apply max timeout of 10 minutes

3. **Safe parsing**
   - Add `try/catch` around `JSON.parse` in `registry.ts`
   - Throw a `ToolValidationError` with a message the LLM can see

## Acceptance Criteria

- [x] Agent loop processes all tool calls in a single LLM response
- [x] Automation run status reflects the actual task outcome
- [x] Invalid tool JSON does not crash the agent loop
- [x] All existing tests pass (48/51 — 3 pre-existing env.test.ts failures unrelated)
- [x] New tests added for multi-tool and safe parsing

## Results

### Test Summary
- **48 passed** / 51 total
- **3 failed** — pre-existing `env.test.ts` failures (MINIMAX provider validation order, not related to these changes)

### New Tests
- `orchestrator.test.ts`: "executes multiple tool calls in a single LLM response"
- `orchestrator.test.ts`: "pauses on approval even when multiple tools are requested"
- `tools/registry.test.ts`: Full test suite for safe JSON parsing (3 tests)

### Changes
- `services/agent/src/orchestrator.ts`: Multi-tool execution loop (lines 512–650)
- `services/agent/src/automation/queue.ts`: Task completion polling with 10-minute timeout
- `services/agent/src/tools/registry.ts`: Safe `JSON.parse` with `ToolValidationError`
- `services/agent/src/orchestrator.test.ts`: 2 new test cases
- `services/agent/src/tools/registry.test.ts`: New test file (3 tests)

## Files to Modify

- `services/agent/src/orchestrator.ts`
- `services/agent/src/automation/queue.ts`
- `services/agent/src/tools/registry.ts`
- `services/agent/src/orchestrator.test.ts`

## Estimated Effort
3–4 hours
