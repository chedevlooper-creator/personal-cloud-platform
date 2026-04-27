# Coding Conventions

**Analysis Date:** 2026-04-27

## Naming Patterns

**Files:**
- Service entry files use `index.ts`.
- Service route files use `routes.ts`; larger surfaces use `routes/<feature>.ts`.
- Service logic commonly uses `service.ts`.
- Frontend component filenames are kebab-case, e.g. `app-shell.tsx`, `tool-approval-card.tsx`.
- Test files use `*.test.ts` and some `src/__tests__/*.test.ts`.

**Functions and Variables:**
- camelCase for functions, local variables, and object fields.
- Classes use PascalCase, e.g. `AuthService`, `RuntimeService`, `AgentOrchestrator`.
- Schema constants use camelCase with `Schema` suffix, e.g. `createTaskSchema`.

**Types:**
- DTO types are exported from Zod with PascalCase names, e.g. `RegisterDto`.
- Interfaces are PascalCase, e.g. `WorkspaceState`, `UseTerminalOptions`.

## Code Style

**Formatting:**
- Prettier config: single quotes, semicolons, print width 100, trailing commas.
- TypeScript strictness is high via `tsconfig.base.json`.
- `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, and `isolatedModules` are enabled.

**Linting:**
- Root `pnpm lint` fans out to packages with a lint script.
- Current lint scripts exist in `apps/web` and `packages/db`.

## Import Organization

**Observed Order:**
1. External packages such as `fastify`, `zod`, `drizzle-orm`.
2. Workspace packages such as `@pcp/db` and `@pcp/shared`.
3. Relative modules such as `./routes`, `./service`.

**Path Aliases:**
- Frontend uses `@/` for `apps/web/src`.
- Backend imports workspace packages through `@pcp/db` and `@pcp/shared`.
- Services currently import DB internals directly from `@pcp/db/src/...`.

## Validation

**HTTP Boundary:**
- Fastify routes use `fastify-type-provider-zod`.
- DTOs should live in `packages/shared/src/` when consumed across services/frontend.

**Environment:**
- Prefer Zod-validated env parsing at startup.
- `packages/db/src/client.ts` shows the target pattern.
- Several services still rely on raw `process.env` fallback values; this should be tightened.

## Error Handling

**Observed Patterns:**
- Service methods throw `Error` for failures.
- Routes often send ad hoc `{ error: string }` responses.
- Workspace has a `WorkspaceError` class for status-aware errors.

**Repo Standard:**
- Use custom error classes.
- Do not leak internal errors to clients.
- Log with correlation/user/service context.
- Return consistent response shapes.

## Logging

**Framework:**
- Pino via Fastify logger.

**Observed Patterns:**
- Development can use `pino-pretty`.
- Some services log operational events, e.g. auth attempts, automation run processing.
- Some code paths use `console.error`, especially provider/service catch handlers.

**Preferred Pattern:**
- Use `fastify.log` or injected service logger.
- Avoid PII and secrets in log payloads.
- Include `correlationId`, `userId`, and `service` where available.

## Database Access

**Current Pattern:**
- Services import Drizzle client and schema directly from `@pcp/db/src`.
- Queries should be scoped by `userId` or `organizationId`.
- Soft-delete tables use `deletedAt`/`deleted_at` where relevant.

**Target Pattern from Rules:**
- Repository layer owns DB access.
- Service layer owns business logic.
- Route layer owns HTTP and Zod validation.

## Comments

**Observed:**
- Comments are common around security, temporary implementations, and TODO-like MVP shortcuts.
- Some comments identify simulated or incomplete behavior in agent and automation flows.

**Preferred:**
- Explain why and risk, not obvious mechanics.
- Avoid commented-out code.
- Add ticket/context for TODOs when they survive beyond local work.

## Function and Module Design

**Observed:**
- Service classes are large and own both domain logic and provider/database access.
- Routes create service instances directly.
- Several DTOs use `z.any()` or route casts to `as any` to work around Fastify/Zod typing.

**Preferred for New Work:**
- Keep route handlers thin.
- Add focused repositories/helpers when logic grows.
- Avoid adding new `any` unless the boundary truly is unknown and immediately narrowed.
- Preserve tenant checks in every DB operation.

## Frontend Conventions

**Structure:**
- App shell wraps authenticated pages through `apps/web/src/app/(main)/layout.tsx`.
- Shared UI primitives live in `apps/web/src/components/ui`.
- Feature components live under `apps/web/src/components/<feature>`.

**State:**
- TanStack Query for API data.
- Zustand for current workspace/editor state.
- Client components are used for interactive app surfaces.

**Styling:**
- Tailwind v4 theme tokens in `apps/web/src/app/globals.css`.
- shadcn-compatible UI primitives.

---
*Convention analysis: 2026-04-27*
*Update when patterns change*
