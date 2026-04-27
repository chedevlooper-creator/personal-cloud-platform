# Structure

*Last mapped: 2026-04-27*

## Top-Level Layout

```
personal-cloud-platform/
├── apps/
│   └── web/                  # Next.js 16 + React 19 frontend (port 3000)
├── services/
│   ├── auth/                 # :3001 — auth, sessions, OAuth, admin gate
│   ├── workspace/            # :3002 — file CRUD, S3 storage, snapshots
│   ├── runtime/              # :3003 — terminal PTY, exec, Docker provider
│   ├── agent/                # :3004 — chat, tools, automations (BullMQ)
│   ├── memory/               # :3005 — pgvector semantic memory
│   └── publish/              # :3006 — host static/Vite/Node apps
├── packages/
│   ├── db/                   # @pcp/db — Drizzle schema/migrations/client/seed
│   └── shared/               # @pcp/shared — Zod DTOs (no build, src-only)
├── infra/
│   └── docker/               # docker-compose.yml + postgres/init.sql
├── scripts/
│   ├── baseline-smoke.mjs    # Root smoke runner
│   ├── baseline-smoke.test.mjs
│   └── setup.sh
├── docs/                     # BUILD_PLAN, DECISIONS, PROGRESS, PRODUCTION
├── .planning/                # GSD planning docs (this directory)
├── package.json              # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json        # strict TS settings (project-wide)
├── AGENTS.md / CLAUDE.md     # Agent guidance (canonical)
└── README.md                 # Some stale areas; trust executable config
```

## Service Internal Layout (typical)

```
services/<svc>/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── index.ts          # Fastify entry: plugins, /health, mount routes
    ├── env.ts            # process.env reads (Zod adoption uneven)
    ├── routes.ts         # OR routes/<feature>.ts for larger surfaces
    ├── service.ts        # Service class — domain logic + DB/provider calls
    ├── service.test.ts   # Vitest co-located test
    └── <subdomains>/     # e.g. auth: routes/, agent: tools/, llm/, automation/
```

### Service-specific subfolders
- `services/auth/src/{routes/, __tests__/, encryption.ts}`
- `services/agent/src/{routes/, llm/, tools/, automation/}`
- `services/runtime/src/provider/{types.ts, docker.ts}`
- `services/memory/src/embeddings/`
- `services/publish/src/{routes.test.ts, service.test.ts}`

## Frontend Internal Layout

```
apps/web/src/
├── app/                  # Next.js App Router
│   ├── layout.tsx        # Root layout
│   └── (main)/
│       ├── layout.tsx    # Authenticated app shell
│       └── <feature>/    # dashboard, files, chat, terminal, automations,
│                         # hosting, snapshots, settings, admin
├── components/
│   ├── ui/               # shadcn / Base UI primitives
│   └── <feature>/        # feature components (kebab-case .tsx)
├── hooks/                # TanStack Query hooks per service
├── lib/                  # service URL config, fetch helpers
├── store/
│   └── workspace.ts      # Zustand state for workspace/editor
└── proxy.ts              # Next proxy/middleware
```

## Database Package (`packages/db/`)

```
packages/db/
├── drizzle.config.ts
├── package.json          # generate, migrate, push, studio, seed scripts
└── src/
    ├── client.ts         # Validated env + Drizzle client (canonical pattern)
    ├── seed.ts
    ├── schema/           # split per domain (users, workspaces, runtimes, ...)
    └── migrations/       # drizzle-kit emitted SQL
```

## Shared Package (`packages/shared/`)
- **No build step** — consumers import from `src/` directly.
- Files: `agent.ts`, `auth.ts`, `automation.ts`, `hosting.ts`, `index.ts`, `memory.ts`, `runtime.ts`, `settings.ts`, `snapshot.ts`, `workspace.ts`.

## Naming Conventions
| Kind                    | Convention                                           |
|-------------------------|------------------------------------------------------|
| Service entry file      | `index.ts`                                           |
| Route file              | `routes.ts` or `routes/<feature>.ts`                 |
| Service logic           | `service.ts`                                         |
| Test files              | `*.test.ts` co-located OR `src/__tests__/*.test.ts`  |
| Frontend components     | kebab-case `.tsx` (`app-shell.tsx`)                  |
| Functions / variables   | camelCase                                            |
| Classes                 | PascalCase (`AuthService`, `AgentOrchestrator`)      |
| Zod schema constants    | `<thing>Schema` (`createTaskSchema`)                 |
| DTO types               | PascalCase (`RegisterDto`)                           |

## Key Locations
- Service contracts + tenant rules: `.cursor/rules/*.mdc` (architecture, backend-standards, database, security, sandbox, testing, frontend, agents).
- Drizzle schema split per domain: `packages/db/src/schema/*`.
- Migrations emitted to: `packages/db/src/migrations/`.
- Provider abstractions: `services/runtime/src/provider/`, `services/agent/src/llm/`.
- MCP-compatible tools: `services/agent/src/tools/`.

## Workspace Rules (pnpm)
- `pnpm-workspace.yaml` includes `apps/*`, `services/*`, `packages/*`.
- Frontend package name is `web` (not `@pcp/web`); services use `@pcp/<svc>-service`; libs use `@pcp/<lib>`.
- Use pnpm filters to operate per-package: `pnpm --filter @pcp/auth-service dev`.
