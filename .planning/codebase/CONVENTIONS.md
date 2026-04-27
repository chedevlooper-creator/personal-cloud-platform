---
focus: quality
mapped_at: 2026-04-27
last_mapped_commit: c55e9b3bb8f13d990887889dfeb3418507c7a360
---

# Conventions

## TypeScript

- Backend packages inherit `tsconfig.base.json`.
- Strict options are enabled, including `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, and `noUnusedLocals`.
- Current source still contains many explicit `any` usages and casts such as `as any`.
- Non-null assertions appear in places like `services/agent/src/routes/automation.ts`.

## Imports

- Workspace packages are imported with pnpm workspace names:
  - `@pcp/db`
  - `@pcp/shared`
- Services often import directly from `@pcp/db/src/client` and `@pcp/db/src/schema`.
- Web imports use `@/*` aliases for `apps/web/src/*`.

## Backend Route Style

- Routes generally use `fastify-type-provider-zod`.
- Shared request/response DTOs usually come from `@pcp/shared`.
- Inline route schemas use `z.object(...)` where no shared DTO exists.
- Error responses are commonly sent as `{ error: string } as any`.
- Response shapes are not consistently wrapped in `{ data, error, meta }` despite the backend rule.

## Backend Service Style

- Service classes hold business logic and database access.
- There is no repository layer yet, despite the intended repository -> service -> route pattern.
- Session validation is duplicated in multiple services.
- Tenant scoping is usually done with Drizzle `and(eq(...userId...))`, but not consistently.
- Some service methods update/delete by resource ID after an ownership pre-check; this is acceptable only if the pre-check and mutation remain adjacent and transactional risks are low.

## Database Style

- Drizzle table definitions use snake_case table and column names.
- Most tables use UUID primary keys with `.defaultRandom()`, not UUID v7.
- Timestamps use `createdAt`, `updatedAt`, and soft-delete columns like `deletedAt` in TypeScript mapped to snake_case SQL.
- Several important indexes exist on user/workspace/status fields.
- Raw SQL is used in memory vector search through `db.execute(sql\`...\`)`.

## Frontend Style

- Most protected UI components are client components.
- TanStack Query hooks are used for auth state in `apps/web/src/lib/auth.ts`.
- Zustand is used for workspace UI state.
- API clients use axios instances with `withCredentials: true`.
- UI is built from local primitives under `apps/web/src/components/ui`.
- Workspace UI uses VS Code-like colors and resizable panels.

## Error Handling

- Many services throw generic `Error`.
- `WorkspaceService` has a custom `WorkspaceError` with HTTP status codes.
- There is no shared app error hierarchy yet.
- Internal errors may bubble to Fastify defaults unless route handlers catch them.

## Logging

- Fastify/pino logging is enabled.
- Development uses `pino-pretty`.
- Required structured fields from repo rules (`correlationId`, `userId`, `service`) are not consistently present.
- Auth service logs email addresses in some paths, which conflicts with the no-PII logging rule.

## Environment Configuration

- `packages/db` validates `DATABASE_URL` with Zod.
- Most services read env vars directly from `process.env`.
- `services/agent/src/env.ts` manually loads local env files for the agent service.
- Several secrets have local fallback values; these should be dev-only and blocked in production startup.

## Formatting And Naming

- Prettier config is declared in repo instructions: single quotes, semicolons, width 100, trailing commas.
- Files use a mix of kebab-case, snake-like names, and simple names.
- Route submodules use `routes/<area>.ts`.
- Test files are colocated as `*.test.ts` or under `src/__tests__`.

## GSD Planning Convention For This Reset

- Old planning files are archived under `.planning/archive/legacy-20260427-reset/`.
- New source-of-truth planning files live at `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, and `.planning/STATE.md`.
- Future phase plans should use this new codebase map, not the archived legacy roadmap.

