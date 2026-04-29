# @pcp/browser-service

Fastify v4 service that drives Playwright browser sessions on behalf of the
agent. Port **3007**, routes under `/api`.

## Routes

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/browser/sessions` | Create a session (launches a Playwright context for the user). |
| `GET` | `/api/browser/sessions` | List active sessions for the user. |
| `GET` | `/api/browser/sessions/:id` | Session detail. |
| `POST` | `/api/browser/sessions/:id/navigate` | Go to URL. |
| `POST` | `/api/browser/sessions/:id/click` | Click selector. **Approval required when called via tool.** |
| `POST` | `/api/browser/sessions/:id/fill` | Fill form field. **Approval required when called via tool.** |
| `POST` | `/api/browser/sessions/:id/screenshot` | Returns PNG bytes. |
| `POST` | `/api/browser/sessions/:id/extract` | Returns serialized page snapshot (text + structured data). |
| `DELETE` | `/api/browser/sessions/:id` | Close session. |

The agent service consumes this surface through the `browser_*` tools (see
[docs/AGENT.md](../../docs/AGENT.md)).

## Tenant isolation

Each session is created inside a per-user Playwright context. Cookies and
storage do not leak between users. Idle sessions are reaped on a timer.

## Environment

| Variable | Purpose |
| --- | --- |
| `PLAYWRIGHT_BROWSERS_PATH` | Optional override for the cached browser bundle. |
| `BROWSER_SESSION_TTL_MS` | Idle timeout before sessions are closed (default: a few minutes). |
| `INTERNAL_SERVICE_TOKEN` | Required for tool-driven calls from the agent service. |
| `AUTH_SERVICE_URL` | Cookie session validation. |

## Scripts

```bash
pnpm --filter @pcp/browser-service dev
pnpm --filter @pcp/browser-service build
pnpm --filter @pcp/browser-service test
pnpm --filter @pcp/browser-service typecheck
```

The first run downloads the Playwright browser bundle, which is large.
In CI use the official Playwright Docker image to skip the download.
