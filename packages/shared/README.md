# @pcp/shared

Pure-TypeScript Zod DTOs and shared types consumed by every service and the
web app.

## No build step

This package is intentionally **source-only**. Consumers import directly:

```ts
import { createTaskSchema, type RegisterDto } from '@pcp/shared';
```

There is no `dist/` and no `build` script. **Never** add `build`
expectations or `dist/` references to other packages — they import from
`src/` via the workspace mapping.

## What lives here

| File | Contents |
| --- | --- |
| `agent.ts` | Task / step / tool-call / approval DTOs. |
| `auth.ts` | Register, login, session, OAuth payloads. |
| `automation.ts` | Automation create/update, run, trigger schemas. |
| `browser.ts` | Browser session + action DTOs. |
| `channels.ts` | Telegram/email/discord linking. |
| `datasets.ts` | Dataset import + query DTOs. |
| `hosting.ts` | Hosted-service create/update/list. |
| `memory.ts` | Memory entry create/search/update. |
| `personas.ts` | Persona CRUD DTOs. |
| `runtime.ts` | Runtime + terminal DTOs. |
| `settings.ts` | User preferences, provider credential CRUD. |
| `skills.ts` | Skill CRUD + match DTOs. |
| `snapshot.ts` | Snapshot create/restore DTOs. |
| `workspace.ts` | Workspace + file DTOs. |
| `index.ts` | Re-exports everything above. |

## Conventions

- **Zod schemas** use camelCase with a `Schema` suffix
  (`createTaskSchema`).
- **DTO types** are inferred and exported with PascalCase names
  (`RegisterDto`).
- Cross-service contracts must live here, not in a service's local file.
- Avoid runtime dependencies — Zod only. The package must remain safe to
  import from both Node services and the Next.js client bundle.

## Scripts

```bash
pnpm --filter @pcp/shared typecheck   # tsc --noEmit
```

There are no tests or linters wired up for this package.
