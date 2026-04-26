# Integrations

Last mapped: 2026-04-27

## Databases

### PostgreSQL (pgvector/pg16)
- **Driver**: `postgres` (postgres.js)
- **ORM**: Drizzle ORM
- **Connection**: `DATABASE_URL` env, validated with Zod
- **Pool**: configurable `DB_MAX_CONNECTIONS` (default 10)
- **Client**: `packages/db/src/client.ts`
- **Health check**: `SELECT 1` query
- **Vector extension**: pgvector enabled for memory service embeddings

### Redis (7-alpine)
- **Port**: 6379
- **Usage**: planned for pub/sub, caching (not yet integrated in service code)
- **Persistence**: AOF enabled (`appendonly yes`)

## Object Storage (MinIO/S3)

- **Service**: workspace service (`services/workspace/src/service.ts`)
- **Client**: `@aws-sdk/client-s3`
- **Bucket**: `pcp-workspace` (env: `S3_BUCKET`)
- **Endpoint**: `http://localhost:9000` (env: `S3_ENDPOINT`)
- **Credentials**: `S3_ACCESS_KEY` / `S3_SECRET_KEY` (falls back to `MINIO_ROOT_USER/PASSWORD`)
- **Operations**: `putText`, `getText`, auto-creates bucket on first use
- **Storage key format**: `{userId}/{workspaceId}/{filePath}`

## AI/LLM Providers

### OpenAI
- **SDK**: `openai` ^4.28
- **Usage**: agent LLM provider, memory embeddings
- **Config**: `OPENAI_API_KEY`, `OPENAI_MODEL` (default: `gpt-4-turbo-preview`)
- **Embedding model**: `text-embedding-3-small` via `services/memory/src/embeddings/openai.ts`

### Anthropic (Claude)
- **SDK**: `@anthropic-ai/sdk` ^0.91
- **Usage**: agent LLM provider
- **Config**: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default: `claude-3-opus-20240229`), `ANTHROPIC_BASE_URL`

### MiniMax
- **Protocol**: Anthropic-compatible API
- **Config**: `MINIMAX_TOKEN_PLAN_API_KEY`, `MINIMAX_MODEL` (default: `MiniMax-M2.7`), `MINIMAX_BASE_URL`
- **Auth**: Bearer token (`Authorization: Bearer <key>`)
- **Selection**: `LLM_PROVIDER=minimax` env var

## Container Runtime

### Docker (via dockerode)
- **Services**: runtime, publish
- **Socket**: `/var/run/docker.sock`
- **Runtime service** (`services/runtime/src/provider/docker.ts`):
  - Container creation, start, stop, exec, attach (terminal), destroy
  - Workspace volume mounting
- **Publish service** (`services/publish/src/service.ts`):
  - Deploys apps as `nginx:alpine` containers
  - Traefik labels for dynamic routing

## Reverse Proxy (Traefik v3)

- **Dashboard**: `:8080` (insecure mode for dev)
- **Entrypoints**: web (80), websecure (443)
- **Docker provider**: labels-based routing
- **Publish routing**: `Host(\`{subdomain}.apps.platform.com\`)`
- **Network**: `pcp-network` bridge

## Email (Mailhog)

- **SMTP**: port 1025
- **Web UI**: port 8025
- **Usage**: development email testing (not yet integrated in service code)

## OAuth Providers

- **Plugin**: `@fastify/oauth2` registered in auth service
- **Schema**: `packages/db/src/schema/oauth_accounts.ts`
- **Supported**: generic OAuth2 via provider ID / provider user ID
- **Token storage**: `accessToken`, `refreshToken` in `oauth_accounts` table

## Webhooks

- No webhook integrations implemented yet

## External APIs

- No other external API integrations beyond LLM providers
