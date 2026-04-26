# Directory Structure

Last mapped: 2026-04-27

## Root Layout

```
personal-cloud-platform/
├── apps/
│   └── web/                    # Next.js 16 frontend
├── services/
│   ├── auth/                   # Authentication (port 3001)
│   ├── workspace/              # File management (port 3002)
│   ├── runtime/                # Docker sandbox (port 3003)
│   ├── agent/                  # AI agent orchestration (port 3004)
│   ├── memory/                 # Semantic memory (port 3005)
│   └── publish/                # App deployment (port 3006)
├── packages/
│   ├── db/                     # Drizzle schema, client, migrations
│   └── shared/                 # DTOs, Zod schemas (no build step)
├── infra/
│   └── docker/                 # Docker Compose + Postgres init SQL
├── docs/                       # BUILD_PLAN.md, DECISIONS.md, PROGRESS.md
├── scripts/                    # Utility scripts
├── .cursor/rules/              # Cursor AI development rules
├── .agent/                     # GSD / Antigravity skills
├── .planning/                  # GSD planning artifacts
├── package.json                # Root workspace config
├── pnpm-workspace.yaml         # pnpm workspace definition
├── tsconfig.base.json          # Shared TypeScript config
├── .prettierrc                 # Prettier config
├── AGENTS.md                   # Repo instructions for AI agents
└── README.md                   # Project overview
```

## Service Internal Layout (standard pattern)

```
services/{name}/
├── src/
│   ├── index.ts                # Fastify server bootstrap
│   ├── routes.ts               # HTTP route handlers
│   ├── service.ts              # Business logic class
│   └── service.test.ts         # Tests (where present)
├── package.json                # Service dependencies
├── tsconfig.json               # Extends tsconfig.base.json
└── vitest.config.ts            # Test config (where present)
```

### Service-Specific Variations

**agent service** — extended structure:
```
services/agent/src/
├── index.ts
├── routes.ts
├── orchestrator.ts             # Agent loop + task management
├── env.ts                      # Custom env file loader
├── orchestrator.test.ts
├── llm/
│   ├── types.ts                # LLMProvider interface
│   ├── provider.ts             # Provider factory
│   ├── anthropic.ts            # Claude adapter
│   └── openai.ts               # OpenAI adapter
└── tools/
    ├── registry.ts             # Tool registration + execution
    └── read_file.ts            # ReadFile tool implementation
```

**runtime service** — provider abstraction:
```
services/runtime/src/
├── index.ts
├── routes.ts
├── service.ts
└── provider/
    ├── types.ts                # RuntimeProvider interface
    └── docker.ts               # Docker implementation
```

**memory service** — embeddings abstraction:
```
services/memory/src/
├── index.ts
├── routes.ts
├── service.ts
├── service.test.ts
└── embeddings/
    ├── types.ts                # EmbeddingProvider interface
    └── openai.ts               # OpenAI embedding implementation
```

## Database Package (`packages/db`)

```
packages/db/
├── src/
│   ├── client.ts               # Drizzle client + pool setup
│   ├── seed.ts                 # Database seeding script
│   ├── schema/
│   │   ├── index.ts            # Re-exports all schema files
│   │   ├── users.ts
│   │   ├── sessions.ts
│   │   ├── oauth_accounts.ts
│   │   ├── audit_logs.ts
│   │   ├── workspaces.ts
│   │   ├── workspace_files.ts
│   │   ├── runtimes.ts
│   │   ├── runtime_logs.ts
│   │   ├── runtime_events.ts
│   │   ├── tasks.ts
│   │   ├── task_steps.ts
│   │   ├── conversations.ts
│   │   ├── tool_calls.ts
│   │   ├── memory_entries.ts
│   │   ├── automations.ts
│   │   ├── publish.ts          # published_apps + app_deployments
│   │   ├── hosted_services.ts
│   │   ├── snapshots.ts
│   │   ├── notifications.ts
│   │   ├── terminal.ts
│   │   ├── skills.ts
│   │   └── provider_credentials.ts
│   └── migrations/             # Drizzle-generated SQL migrations
├── drizzle.config.ts           # Drizzle Kit config
└── package.json
```

**22 schema files** covering users, auth, workspaces, runtimes, agent tasks, memory, publishing, and supporting tables.

## Shared Package (`packages/shared`)

```
packages/shared/src/
├── index.ts                    # Re-exports all DTOs
├── auth.ts                     # Auth Zod schemas/types
├── workspace.ts                # Workspace Zod schemas/types
├── runtime.ts                  # Runtime Zod schemas/types
├── agent.ts                    # Agent Zod schemas/types
└── memory.ts                   # Memory Zod schemas/types
```

**No build step** — consumers import from `src/` directly.

## Frontend (`apps/web`)

```
apps/web/src/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Landing page
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   └── (main)/
│       ├── layout.tsx          # Authenticated shell layout
│       ├── dashboard/page.tsx
│       ├── chats/page.tsx
│       ├── files/page.tsx
│       ├── workspace/[id]/page.tsx
│       ├── workspaces/page.tsx
│       ├── terminal/page.tsx
│       ├── hosting/page.tsx
│       ├── automations/page.tsx
│       ├── skills/page.tsx
│       ├── space/page.tsx
│       ├── computer/page.tsx
│       ├── apps/page.tsx
│       ├── bookmarks/page.tsx
│       ├── datasets/page.tsx
│       └── settings/page.tsx
├── components/
│   ├── ui/                     # shadcn components (button, dialog, tabs, etc.)
│   ├── app-shell/              # Main app chrome (sidebar, command palette, etc.)
│   ├── workspace/              # Workspace UI (file-tree, editor, terminal, chat)
│   └── providers.tsx           # Context providers
├── lib/
│   ├── api.ts                  # Axios HTTP client
│   ├── auth.ts                 # Auth utilities
│   ├── utils.ts                # cn() utility
│   └── format.ts               # Formatting helpers
├── store/
│   └── workspace.ts            # Zustand workspace state
└── proxy.ts                    # Dev proxy configuration
```

## Key Locations

| What                  | Where                                      |
|-----------------------|--------------------------------------------|
| DB schema             | `packages/db/src/schema/`                  |
| DB client             | `packages/db/src/client.ts`                |
| DB migrations         | `packages/db/src/migrations/`              |
| Shared DTOs           | `packages/shared/src/`                     |
| Service entry points  | `services/*/src/index.ts`                  |
| Service routes        | `services/*/src/routes.ts`                 |
| Agent orchestrator    | `services/agent/src/orchestrator.ts`       |
| LLM providers         | `services/agent/src/llm/`                  |
| Agent tools           | `services/agent/src/tools/`                |
| Infra config          | `infra/docker/docker-compose.yml`          |
| Architecture rules    | `.cursor/rules/*.mdc`                      |
| Build plan            | `docs/BUILD_PLAN.md`                       |
| Decisions log         | `docs/DECISIONS.md`                        |

## Naming Conventions

- **Packages**: `@pcp/{name}` (e.g. `@pcp/db`, `@pcp/auth-service`)
- **Frontend**: package name is `web` (not `@pcp/web`)
- **Files**: kebab-case for components, camelCase for utilities
- **Database columns**: snake_case
- **TypeScript**: camelCase for variables/functions, PascalCase for classes/types
