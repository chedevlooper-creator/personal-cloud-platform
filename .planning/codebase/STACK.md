# Technology Stack

Last mapped: 2026-04-27

## Runtime & Languages

- **Node.js** 20+ (required engine)
- **TypeScript** ^5.4 — strict mode, `noUncheckedIndexedAccess`, `isolatedModules`
- **Module system**: ESNext + Bundler module resolution (`tsconfig.base.json`)

## Package Management

- **pnpm** 9+ (required engine)
- **Workspace**: `pnpm-workspace.yaml` covers `packages/*`, `services/*`, `apps/*`
- Root scripts: `pnpm -r` fan-outs (`dev`, `build`, `lint`, `test`, `format`)

## Backend Framework

- **Fastify** v4.26 — all 6 services
- **fastify-type-provider-zod** v1.1 — Zod-based request/response validation
- **tsx** v4.7 — dev mode (`tsx watch src/index.ts`)
- **tsc** — production build

### Service Ports

| Service   | Package Name             | Port |
|-----------|--------------------------|------|
| auth      | `@pcp/auth-service`      | 3001 |
| workspace | `@pcp/workspace-service` | 3002 |
| runtime   | `@pcp/runtime-service`   | 3003 |
| agent     | `@pcp/agent-service`     | 3004 |
| memory    | `@pcp/memory-service`    | 3005 |
| publish   | `@pcp/publish-service`   | 3006 |

## Frontend

- **Next.js** 16.2.4 + **React** 19.2
- **Tailwind CSS** v4 + `@tailwindcss/postcss`
- **shadcn** v4.5 — UI component library
- **Zustand** v5 — client state
- **TanStack React Query** v5 — server state
- **Monaco Editor** v4.7 — code editing (`@monaco-editor/react`)
- **xterm.js** v6 — terminal emulation (`@xterm/xterm`, `@xterm/addon-fit`)
- **Lucide React** — icon library
- **Axios** — HTTP client
- **next-themes** — theme management
- **sonner** — toast notifications
- **react-resizable-panels** — panel layout

## Database

- **Drizzle ORM** ^0.45 — schema definition + query builder
- **Drizzle Kit** ^0.31 — migrations (`generate`, `migrate`, `push`, `studio`)
- **postgres.js** (postgres) ^3.4 — PostgreSQL driver
- **pgvector** — vector similarity search (memory service)
- Schema files: `packages/db/src/schema/*.ts`
- Migrations: `packages/db/src/migrations/`
- Config validation: Zod at startup (`packages/db/drizzle.config.ts`, `packages/db/src/client.ts`)

## AI / LLM

- **@anthropic-ai/sdk** ^0.91 — Anthropic Claude (agent service)
- **openai** ^4.28 — OpenAI API (agent + memory services)
- **MiniMax** — via Anthropic-compatible API (configurable)
- Provider abstraction: `services/agent/src/llm/provider.ts`
- Supported providers: `openai`, `anthropic`, `minimax`

## Infrastructure (Docker Compose)

| Service  | Image                     | Port(s)       |
|----------|---------------------------|---------------|
| Postgres | `pgvector/pgvector:pg16`  | 5432          |
| Redis    | `redis:7-alpine`          | 6379          |
| MinIO    | `minio/minio:latest`      | 9000, 9001    |
| Traefik  | `traefik:v3.0`            | 80, 443, 8080 |
| Mailhog  | `mailhog/mailhog:latest`  | 1025, 8025    |

## Authentication

- **argon2** ^0.40 — password hashing
- **@fastify/cookie** — session cookies
- **@fastify/oauth2** — OAuth providers
- **@fastify/rate-limit** — rate limiting

## Object Storage

- **@aws-sdk/client-s3** — S3/MinIO integration (workspace service)
- Bucket: `pcp-workspace` (configurable)

## Container Management

- **dockerode** — Docker API client (runtime + publish services)

## Dev Dependencies

- **vitest** — test runner (^4.1.5 for auth/workspace, ^1.4.0 for others)
- **pino** + **pino-pretty** — structured logging
- **prettier** ^3.2 — code formatting
- **eslint** ^9 — linting (web app)

## Configuration

- Env files loaded via custom `env.ts` in agent service
- Env validation via Zod schemas at startup
- `.prettierrc`: single quotes, semis, width 100, trailing commas
- `tsconfig.base.json`: strict mode with all safety checks enabled
