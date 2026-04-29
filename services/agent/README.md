# @pcp/agent-service

Fastify v4 service that owns the AI operator: chats, agent tasks, automations,
personas, skills, channel links, and notifications. Port **3004**, all routes
mounted under `/api`.

See [docs/AGENT.md](../../docs/AGENT.md) for the system-prompt pipeline,
tool catalog, and BYOK details.

## Routes (selection)

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/agent/chat` | One-shot chat. Honors per-user persona/rules/skills/provider. |
| `POST` | `/api/agent/tasks` | Create a new task; returns task id. |
| `GET` | `/api/agent/tasks/:id` | Task detail. |
| `GET` | `/api/agent/tasks/:id/steps` | Step log. |
| `POST` | `/api/agent/tasks/:id/cancel` | Cooperative cancel. |
| `POST` | `/api/agent/tasks/:id/tool-approval` | Approve or reject a parked tool call. |
| `GET` / `POST` / `DELETE` | `/api/agent/conversations[/:id[/messages]]` | Conversation CRUD + message stream. |
| `GET` / `POST` / `PATCH` / `DELETE` | `/api/automations[/:id[/runs|/trigger-token]]` | BullMQ-backed scheduler. |
| `POST` | `/api/automations/:id/run` | Manual trigger from the UI. |
| `POST` | `/api/automations/:id/trigger` | External trigger (per-automation token). |
| `GET` / `POST` / `PATCH` / `DELETE` | `/api/personas[/:id]` | Per-user prompt presets. |
| `GET` / `POST` / `PATCH` / `DELETE` | `/api/skills[/:id]` | Capability library. |
| `POST` | `/api/skills/match` | Suggest skills for a given prompt. |
| `GET` / `POST` / `DELETE` | `/api/channels/links[/:id]` | Telegram/email/discord linking. |

## Environment

Validated via Zod in `src/env.ts`. Loads `.env.local`, `.env`, and
`infra/docker/.env`.

| Variable | Purpose |
| --- | --- |
| `LLM_PROVIDER` | `openai` \| `anthropic` \| `minimax` (default). |
| `MINIMAX_BASE_URL` | Anthropic-compatible endpoint (default `https://api.minimax.io/anthropic`). |
| `MINIMAX_API_KEY`, `MINIMAX_MODEL` | MiniMax credentials and model. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Used when provider is `openai`, or via BYOK. |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Used when provider is `anthropic`, or via BYOK. |
| `ENCRYPTION_KEY` | 32-byte utf-8 key. Required for BYOK decrypt. |
| `INTERNAL_SERVICE_TOKEN` | Shared secret for cross-service calls. |
| `REDIS_URL` | BullMQ queue/cache. |
| `WORKSPACE_SERVICE_URL`, `RUNTIME_SERVICE_URL`, `MEMORY_SERVICE_URL`, `BROWSER_SERVICE_URL` | Tool bridges. |
| `AUTH_SERVICE_URL` | Cookie session validation. |

## BullMQ workers

`src/automation/queue.ts` boots a worker on `REDIS_URL`. Cron jobs are
seeded from the `automations` table at startup and refreshed when rows
change. Each run inserts an `automation_runs` row and (optionally)
notifies per `notificationMode`.

## Scripts

```bash
pnpm --filter @pcp/agent-service dev        # tsx watch
pnpm --filter @pcp/agent-service build      # tsc
pnpm --filter @pcp/agent-service test       # vitest
pnpm --filter @pcp/agent-service typecheck  # tsc --noEmit
```
