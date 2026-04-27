# External Integrations

**Analysis Date:** 2026-04-27

## APIs & External Services

**LLM Providers:**
- OpenAI - Chat provider and embeddings.
  - SDK/Client: `openai` in `services/agent` and `services/memory`.
  - Auth: `OPENAI_API_KEY`.
  - Usage: `services/agent/src/llm/openai.ts`, `services/memory/src/embeddings/openai.ts`.
- Anthropic - Chat provider.
  - SDK/Client: `@anthropic-ai/sdk`.
  - Auth: `ANTHROPIC_API_KEY`.
  - Usage: `services/agent/src/llm/anthropic.ts`.
- MiniMax Anthropic-compatible endpoint - Default/provider option in the agent service.
  - Auth: `MINIMAX_TOKEN_PLAN_API_KEY` or `MINIMAX_API_KEY`.
  - Base URL: `MINIMAX_BASE_URL`.
  - Usage: `services/agent/src/llm/provider.ts`.

**OAuth:**
- Google OAuth - Login provider in auth service.
  - SDK/Client: `@fastify/oauth2`.
  - Auth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
  - Callback: `services/auth/src/routes.ts`.

**Email:**
- Mailhog - Local SMTP capture.
  - Infra: `infra/docker/docker-compose.yml`.
  - Current app usage: env placeholder only; no production email implementation is evident.

## Data Storage

**Database:**
- PostgreSQL 16 with pgvector - Main relational and vector store.
  - Connection: `DATABASE_URL`.
  - Client: Drizzle ORM via `packages/db/src/client.ts`.
  - Migrations: `packages/db/src/migrations/`.
  - Extensions: `uuid-ossp`, `pgcrypto`, `vector` in `infra/docker/postgres/init.sql`.

**Object Storage:**
- MinIO / S3-compatible storage - Workspace file content and snapshots.
  - SDK/Client: AWS SDK v3 in `services/workspace`.
  - Auth: `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`.
  - Tenant path convention: storage keys must be user/workspace-prefixed per repo rules.

**Queue/Cache:**
- Redis 7 - BullMQ automation queue backing.
  - Connection: `REDIS_URL`.
  - Usage: `services/agent/src/automation/queue.ts`.

## Authentication & Identity

**Session Auth:**
- Custom email/password and OAuth-backed sessions.
  - Storage: `sessions` table.
  - Token transport: `sessionId` HTTP-only cookie.
  - Password hashing: Argon2 in `services/auth/src/service.ts`.

**Credentials Storage:**
- Provider credentials and integration secrets are modeled as AES-256-GCM encrypted rows.
  - Schema: `packages/db/src/schema/provider_credentials.ts`, `packages/db/src/schema/integrations.ts`.
  - Implementation: `services/auth/src/encryption.ts`.

## Runtime and Hosting

**Docker Engine:**
- Runtime service creates sandbox containers through Dockerode.
  - Provider: `services/runtime/src/provider/docker.ts`.
  - Default runtime network mode: `none`.
- Publish service creates hosted service containers through Dockerode.
  - Provider: `services/publish/src/service.ts`.
  - Traefik labels route `*.apps.localhost`.

**Traefik:**
- Local reverse proxy and hosted app router.
  - Config: `infra/docker/docker-compose.yml`.
  - Publish labels are generated in `services/publish/src/service.ts`.

## Frontend-to-Service APIs

**Browser API Clients:**
- Auth: `NEXT_PUBLIC_AUTH_API_URL` or `http://localhost:3001/auth`.
- Workspace: `NEXT_PUBLIC_WORKSPACE_API_URL` or `http://localhost:3002/api`.
- Runtime: `NEXT_PUBLIC_RUNTIME_API_URL` or `http://localhost:3003/api`.
- Agent: `NEXT_PUBLIC_AGENT_API_URL` or `http://localhost:3004/api`.
- Publish: `NEXT_PUBLIC_PUBLISH_API_URL` or `http://localhost:3006/publish`.
- Client definitions: `apps/web/src/lib/api.ts`.

## Monitoring & Observability

**Logs:**
- Pino is configured in each Fastify service.
- Production docs expect structured logs with service/user/correlation context, but current service code often logs minimal context.

**Health Checks:**
- Each service exposes `GET /health` on its own port.
- Infra services define Docker health checks in `infra/docker/docker-compose.yml`.

## Environment Configuration

**Development:**
- `infra/docker/.env.example` provides local infra defaults.
- `infra/docker/.env` is ignored and must not be committed.
- Some services currently include insecure fallback secrets for local dev; production must override them.

**Production:**
- `docs/PRODUCTION.md` recommends managed Postgres/Redis/S3, HTTPS through Traefik, strict CORS, secure cookies, image scanning, and backups.

## Webhooks & Callbacks

**Incoming:**
- Google OAuth callback: `/auth/oauth/google/callback`.
- No Stripe/payment webhook implementation is present.

**Outgoing:**
- Automation webhook notification mode exists in schema/DTOs, but implementation appears incomplete.

---
*Integration audit: 2026-04-27*
*Update when adding/removing external services*
