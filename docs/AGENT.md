# Agent System

End-to-end behavior of the AI operator: how a request becomes a task, how the
system prompt is assembled, how tools are dispatched, and how user-supplied
provider keys override the global defaults.

## Lifecycle

A user message hits `POST /api/agent/chat` (or `POST /api/agent/tasks`).
Inside `services/agent/src/orchestrator.ts`:

1. `createTask(userId, workspaceId, input, conversationId?, { personaId?, skillIds? })`
   inserts a `tasks` row with `metadata = { personaId, skillIds }`.
2. `runAgentLoop(taskId, userId)` runs the ReAct loop, capped at **15
   iterations**.
3. Each iteration:
   - Builds `messages` from prior `task_steps` and the current
     `system` prompt.
   - Calls `llm.generate(messages, tools)` (see BYOK below).
   - If the response includes a `tool_call`, validates input against the
     tool's Zod schema. If `tool.requiresApproval` is true, the call is
     parked as `tool_calls.status='awaiting_approval'` and an
     `approval_requests` row is created. The task transitions to
     `waiting_approval` until the user approves or rejects via
     `POST /api/agent/tasks/:id/tool-approval`.
   - Executes the tool, persists `task_steps` (`thought`/`action`/`observation`)
     and the `tool_calls` row.
4. The loop ends when the model returns a final answer, the iteration cap
   is hit (`failed`), the task is `cancelled`, or a tool throws fatally.

Conversations carry `channel ∈ {web, telegram, email, discord}` and a
`personaId`. Telegram/email inbound is routed by `channel_links`.

## System prompt pipeline

`buildSystemPrompt(userId, base, metadata)` (orchestrator.ts) concatenates,
in order:

1. **Base instructions** — short fixed string about being concise and
   actionable.
2. **Persona** — `metadata.personaId`, falling back to the user's
   `personas.isDefault=true` row. The persona's `systemPrompt` is appended as
   `# Persona: <name>`.
3. **User rules** — `user_preferences.rules`, appended as `# User Rules`.
   Free-text guidance the user has saved in Settings.
4. **Skills** — for each `metadata.skillIds[]` that belongs to the user, is
   `enabled=true`, and not soft-deleted, the `skills.bodyMarkdown` is
   appended as `# Skill: <name>`.

The frontend's chat surface passes `personaId` and `skillIds` from the
`ChatContextBar` so the same chain works in the web UI and via channels.

## BYOK (Bring Your Own Key)

`services/agent/src/llm/credentials.ts → resolveUserProvider(userId)`:

1. Read `user_preferences` for `defaultProvider` and `defaultModel`.
2. Read the most recent active row in `provider_credentials` for that
   provider (or any active row if no preference is set).
3. AES-256-GCM-decrypt the API key with `ENCRYPTION_KEY` (32 bytes utf-8).
4. Build an env overlay:
   - `LLM_PROVIDER` = `openai` | `anthropic` | `minimax`
   - Provider-specific key (`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` /
     `MINIMAX_API_KEY`)
   - Optional `*_MODEL` from preferences
5. `createLLMProvider(overlay)` returns a provider instance just for this
   request. `lastUsedAt` is touched fire-and-forget.

If any step fails (no credential, decrypt error, missing key), the
orchestrator falls back to the process-level provider (`this.llm`).

`runAgentLoop` and `chat` both apply this override per-call, so a single
service instance serves many users without leaking keys across requests.

## Tool catalog

All tools live under [services/agent/src/tools](../services/agent/src/tools)
and are registered in `Orchestrator`'s constructor. The registry validates
input with Zod and gates approval. Output is truncated where noted.

| Tool | Approval | Side effect | Notes |
| --- | --- | --- | --- |
| `read_file` | no | none | Reads from workspace via the workspace service. |
| `write_file` | **yes** | mutates workspace | Creates parents as needed. |
| `list_files` | no | none | Directory listing. |
| `run_command` | **yes** | runs in runtime container | `sh -c`, 60s cap, no network, output truncated to 32 KB. |
| `web_search` | no | external HTTP | Provider configured via env; results summarized. |
| `web_fetch` | no | external HTTP | Single URL fetch with size cap. |
| `search_memory` | no | reads `memory_entries` | Cosine search with pgvector. |
| `add_memory` | no | inserts `memory_entries` | Embeds via memory service. |
| `query_dataset` | no | reads DuckDB | Per-user DuckDB; tenant-scoped. |
| `browser_open` | no | starts Playwright session | Tracked in browser service. |
| `browser_extract` | no | reads page | Returns serialized snapshot. |
| `browser_screenshot` | no | reads page | Image bytes via session id. |
| `browser_click` | **yes** | mutates page | Selector-based. |
| `browser_fill` | **yes** | mutates page | Form input. |

`requiresApproval=true` tools surface in the UI as a `ToolApprovalCard` and
generate an `approval_requests` row with an `expiresAt`. Expired requests
flip the tool call to `timeout`.

## Memory

The memory service exposes `POST /api/memory/entries`,
`POST /api/memory/search`, and per-row `PATCH`/`DELETE`. Embeddings use:

- **OpenAI** `text-embedding-3-small` when `OPENAI_API_KEY` is configured
  with a real key.
- **Local hash fallback** otherwise — SHA-256 per token spread across a
  1536-dim Float64Array, signed and L2-normalized. Deterministic and
  dependency-free; sufficient for development.

Search is a raw SQL cosine query against the pgvector column;
`packages/db` declares `vector(1536)` as a custom type.

## Automations

`services/agent/src/automation/queue.ts` runs a BullMQ worker on Redis.
`automations.scheduleType` covers `manual`, `hourly`, `daily`, `weekly`,
and `cron`. Each execution:

1. Spawns a `tasks` row with `trigger='schedule'` (or `manual`/`webhook`).
2. Runs `runAgentLoop` to completion or failure.
3. Records an `automation_runs` row.
4. Notifies per `notificationMode`: `in-app` writes a `notifications`
   row; `email-mock` posts to Mailhog; `webhook` POSTs to
   `notification_prefs.webhookUrl` or the automation's webhook URL.

Manual triggers from the UI use
`POST /api/automations/:id/run`. External callers use
`POST /api/automations/:id/trigger` with the per-automation token.

## Channels

Telegram / email inbound is mapped through `channel_links`. The agent
service mounts:

- `POST /api/channels/links` — connect a channel.
- `GET /api/channels/links` — list links.
- `DELETE /api/channels/links/:id` — disconnect.

The orchestrator threads `channel` through to the `conversations` row so
`buildSystemPrompt` can be future-extended per surface.

## Where to look

- ReAct loop and prompt assembly:
  [services/agent/src/orchestrator.ts](../services/agent/src/orchestrator.ts)
- Provider resolution:
  [services/agent/src/llm/credentials.ts](../services/agent/src/llm/credentials.ts)
- Tool surface:
  [services/agent/src/tools](../services/agent/src/tools)
- Routes:
  [services/agent/src/routes.ts](../services/agent/src/routes.ts) and
  [services/agent/src/routes](../services/agent/src/routes)
- Schema:
  [packages/db/src/schema](../packages/db/src/schema) and
  [docs/DATA_MODEL.md](DATA_MODEL.md)
