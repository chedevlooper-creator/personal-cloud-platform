# Integrations

*Last mapped: 2026-04-27*

External systems this codebase talks to and where the boundary lives.

## Database — PostgreSQL (+ pgvector)
- **Client:** `packages/db/src/client.ts` (postgres driver + Drizzle).
- **Schema:** `packages/db/src/schema/*` — users, sessions, workspaces, workspace_files, runtimes, runtime_logs, runtime_events, agent_tasks, agent_task_steps, memory_entries (pgvector), published_apps, settings, audit_logs, integrations, notifications, snapshots.
- **Migrations:** `packages/db/src/migrations/` (drizzle-kit).
- **pgvector** is required (memory service); image is `pgvector/pgvector:pg16` in `infra/docker/docker-compose.yml`.
- **Tenant rule:** every query filters by `user_id` / `organization_id` (see AGENTS.md + `.cursor/rules/database.mdc`).

## Object Storage — MinIO / S3
- **SDK:** `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`.
- **Used by:** `services/workspace` (file contents, snapshots).
- **Local:** MinIO containers (`pcp-minio`) on :9000 (API) / :9001 (console).
- **Tenant rule:** S3 paths are tenant-prefixed.

## Cache + Queue — Redis 7 / BullMQ
- **Queue:** `services/agent/src/automation/queue.ts` (BullMQ + ioredis).
- **Use cases:** automation scheduling (manual/hourly/daily/weekly/cron), run history.
- **Local:** `pcp-redis` on :6379.

## Reverse Proxy — Traefik 3
- Local: `pcp-traefik` (:80, :443, dashboard :8080) — `infra/docker/docker-compose.yml`.
- Used in production and by `services/publish` for routing hosted apps to subdomains.
- Mounts `/var/run/docker.sock:ro` for Docker provider.

## SMTP (dev) — Mailhog
- Local container only; production SMTP not configured in repo.

## Auth Providers
- **Email/password** — Argon2 hashing; `services/auth/src/service.ts`.
- **Google OAuth** — env `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`; routes under `services/auth/src/routes/`.
- **Sessions** — HTTP-only cookies signed with `COOKIE_SECRET`.

## LLM Providers (BYOK — keys stored AES-256-GCM in DB)
- **OpenAI** — chat + embeddings (`services/agent/src/llm/`, `services/memory/src/embeddings/`).
- **Anthropic** — chat (`services/agent/src/llm/`).
- **MiniMax** — Anthropic-compatible interface.
- Provider abstraction: `services/agent/src/llm/types.ts` + `services/agent/src/llm/provider.ts`.

## Container Runtime — Docker (Dockerode)
- **Used by:**
  - `services/runtime` — workspace exec / web terminal PTY (`services/runtime/src/provider/docker.ts`).
  - `services/publish` — deploy hosted static sites / Vite apps / Node APIs.
- **Runtime abstraction:** `services/runtime/src/provider/types.ts` (so Firecracker/microVM can replace Docker — see ADR-003).

## Webhooks / Inbound
- None defined in this snapshot of the codebase.

## Inter-service Communication
- **No cross-service DB access** (architectural rule).
- Services talk over HTTP, with Redis pub/sub + BullMQ for async work.
- DTOs are imported from `@pcp/shared/src` directly (no build step).

## Service Ports (local)
| Service              | Port |
|----------------------|------|
| `apps/web`           | 3000 |
| `services/auth`      | 3001 |
| `services/workspace` | 3002 |
| `services/runtime`   | 3003 |
| `services/agent`     | 3004 |
| `services/memory`    | 3005 |
| `services/publish`   | 3006 |

## Required Env (from README)
| Variable               | Required | Description                                |
|------------------------|----------|--------------------------------------------|
| `DATABASE_URL`         | yes      | PostgreSQL connection string               |
| `REDIS_URL`            | yes      | Redis connection string                    |
| `S3_ENDPOINT`          | yes      | MinIO/S3 endpoint                          |
| `S3_ACCESS_KEY`        | yes      | S3 access key                              |
| `S3_SECRET_KEY`        | yes      | S3 secret key                              |
| `COOKIE_SECRET`        | yes      | Session cookie signing secret              |
| `ENCRYPTION_KEY`       | yes      | 32-byte AES-256-GCM key (BYOK encryption)  |
| `ADMIN_EMAIL`          | optional | Gates `/admin` routes                      |
| `GOOGLE_CLIENT_ID`     | optional | Google OAuth                               |
| `GOOGLE_CLIENT_SECRET` | optional | Google OAuth                               |
