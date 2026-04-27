---
focus: tech
mapped_at: 2026-04-27
last_mapped_commit: c55e9b3bb8f13d990887889dfeb3418507c7a360
---

# Integrations

## Overview

The app integrates with local infrastructure through Docker Compose and with AI providers through service-level SDK clients. The frontend currently talks directly to service ports rather than through a single API gateway.

## Database

- PostgreSQL is the source of truth through `packages/db/src/client.ts`.
- `DATABASE_URL` is parsed with Zod in both `packages/db/src/client.ts` and `packages/db/drizzle.config.ts`.
- Drizzle schema is centralized in `packages/db/src/schema/index.ts`.
- Services import `@pcp/db/src/client` and `@pcp/db/src/schema` directly.
- pgvector is required for `services/memory` through the custom vector type in `packages/db/src/schema/memory_entries.ts`.

## Redis And Queues

- Redis URL defaults to `redis://localhost:6379`.
- BullMQ queue is initialized in `services/agent/src/automation/queue.ts`.
- Automation jobs create agent tasks and update `automation_runs`.
- Scheduled repeat jobs are keyed as `automation-<id>`.

## Object Storage

- Workspace file content uses S3-compatible storage in `services/workspace/src/service.ts`.
- Default endpoint is `http://localhost:9000`, matching MinIO in `infra/docker/docker-compose.yml`.
- Object keys are tenant/workspace prefixed as `${userId}/${workspaceId}${path}`.
- Snapshot rows are created with `snapshots/<workspaceId>/<timestamp>.tar.gz`, but actual archive creation/restoration is currently simplified.

## Docker And Container Runtime

- Runtime containers are created with Dockerode in `services/runtime/src/provider/docker.ts`.
- Runtime containers mount `/tmp/workspaces/<workspaceId>` at `/workspace`.
- Runtime networking is disabled with `NetworkMode: 'none'`.
- Publish containers are created in `services/publish/src/service.ts` and attached to Traefik via labels.
- Publish containers use the Docker network name `pcp_network`, while Compose declares `pcp-network`; this should be verified because Docker Compose often materializes project-prefixed names.

## Traefik

- `infra/docker/docker-compose.yml` runs Traefik v3 on ports 80, 443, and dashboard 8080.
- Hosted app routing uses labels like `traefik.http.routers.<container>.rule`.
- Published URLs are shaped as `http://<slug>.apps.localhost`.

## Authentication Providers

- Email/password registration and login are implemented in `services/auth/src/service.ts`.
- Password hashing uses Argon2 through `argon2.hash` and `argon2.verify`.
- Google OAuth is registered in `services/auth/src/routes.ts` via `@fastify/oauth2`.
- OAuth account records are persisted in `packages/db/src/schema/oauth_accounts.ts`.

## AI Providers

- `services/agent/src/llm/provider.ts` selects provider from `LLM_PROVIDER`.
- Providers:
  - OpenAI through `services/agent/src/llm/openai.ts`.
  - Anthropic through `services/agent/src/llm/anthropic.ts`.
  - Minimax through the Anthropic-compatible class with bearer auth.
- User BYOK provider credentials are stored in `provider_credentials` through profile routes in `services/auth/src/routes/profile.ts`.
- Provider credentials are encrypted with AES-256-GCM in `services/auth/src/encryption.ts`.

## Frontend API Endpoints

The web client uses direct service URLs from `apps/web/src/lib/api.ts`:

| Client | Default URL |
|--------|-------------|
| Auth | `http://localhost:3001/auth` |
| Workspace | `http://localhost:3002/api` |
| Runtime | `http://localhost:3003/api` |
| Agent | `http://localhost:3004/api` |
| Publish | `http://localhost:3006/publish` |

## Mail And Notifications

- Mailhog is included in Compose but no full email sending integration is visible yet.
- Notifications and integrations tables exist in `packages/db/src/schema/notifications.ts`.
- Automation notification mode supports `none`, `in-app`, `email-mock`, and `webhook` in shared schemas.

## External Surface To Harden

- CORS is currently `origin: true` in services, which reflects origins broadly.
- Several services use default local secrets when env vars are absent.
- Publish endpoints accept `userId` in request body/query instead of deriving user identity from session cookies.
- There is no internal service authentication between services yet.

