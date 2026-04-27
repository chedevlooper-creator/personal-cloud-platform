# Conventions

*Last mapped: 2026-04-27*

## Code Style
- **Prettier** (`.prettierrc`): single quotes, semicolons, print width 100, trailing commas.
- **TypeScript strictness** is high (`tsconfig.base.json`):
  - `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`, `isolatedModules`.
  - Index/array access yields `T | undefined` — narrow before use.
- **ESLint** runs only in packages with a `lint` script — currently `apps/web` and `packages/db`. Other services have no lint config yet.

## Naming
- Functions, variables, object fields: **camelCase**.
- Classes: **PascalCase** (`AuthService`, `RuntimeService`, `AgentOrchestrator`).
- Zod schema constants: `<x>Schema` (`createTaskSchema`).
- DTO types: PascalCase (`RegisterDto`).
- Interfaces: PascalCase (`WorkspaceState`, `UseTerminalOptions`).
- Frontend filenames: kebab-case `.tsx` (`app-shell.tsx`, `tool-approval-card.tsx`).
- Service entry: `index.ts`. Service logic: `service.ts`. Routes: `routes.ts` or `routes/<feature>.ts`.
- Tests: `*.test.ts` co-located, or `src/__tests__/*.test.ts`.

## Imports
- Frontend uses `@/` for `apps/web/src` (per `tsconfig.json` paths).
- Backend imports workspace packages via `@pcp/db` and `@pcp/shared`.
- Services currently import DB internals from `@pcp/db/src/...` directly (acceptable because `@pcp/shared` and `@pcp/db` use source consumption — the latter via explicit subpaths).
- `@pcp/shared` has **no `dist/`** — never add a `build` step expectation; consumers import from `src/`.

## Validation
- Routes use `fastify-type-provider-zod`; request/response Zod schemas are required for every route.
- DTOs shared across service+frontend live in `packages/shared/src/`.
- **Env validation:** `packages/db/src/client.ts` is the canonical pattern (Zod-at-startup). Several services still use raw `process.env` fallbacks — should be tightened (CONCERNS.md).

## Error Handling
- Service methods throw `Error` for failures; some routes still respond with ad-hoc `{ error: string }` shapes.
- `services/workspace/src/...` defines `WorkspaceError` (HTTP-status-aware) — preferred pattern; replicate per service.
- **Rules:**
  - Use custom error classes; do not leak internal errors to clients.
  - Log with `correlationId`, `userId`, `service` context.
  - Return consistent JSON response shapes.

## Logging
- **Pino** via Fastify (`fastify.log`), with `pino-pretty` in dev.
- Required fields where available: `correlationId`, `userId`, `service`. **No PII**, no secrets.
- Some provider/catch handlers use `console.error` — prefer the Fastify logger.

## Database Access
- All Drizzle access goes through `@pcp/db/src/client`.
- **Tenant rule:** every query filters by `userId` or `organizationId`.
- Soft deletes use `deletedAt` / `deleted_at` where present.
- Target layering: **repository (DB only) → service (logic) → route (HTTP + Zod)**. Today the repository is implicit (queries inline in service classes); split out as services grow.

## Comments
- Acceptable: explanations of *why* + risk for security-sensitive code, or context/ticket links for surviving TODOs.
- Avoid: commented-out code, narration of obvious mechanics.
- Honest markers: `Simulated` strings exist in agent tool stubs (`run_command`, `read_file`, `list_files`) — flagged in CONCERNS.md, *not* a style template.

## Module Design
- Service classes are large — they currently own domain logic *and* provider/DB access.
- Routes create service instances directly.
- Several DTOs use `z.any()` or route-level `as any` casts to satisfy Fastify+Zod typing constraints. Avoid adding new `any` unless the boundary is genuinely opaque and immediately narrowed.
- **Always preserve tenant checks** when touching DB ops.

## Frontend Conventions
- Auth-protected pages wrap through `apps/web/src/app/(main)/layout.tsx`.
- Shared UI primitives in `apps/web/src/components/ui/`.
- Feature components under `apps/web/src/components/<feature>/`.
- **TanStack Query** for API data; **Zustand** for current workspace/editor state.
- Tailwind v4 theme tokens in `apps/web/src/app/globals.css`.
- Next.js 16 + React 19 — confirm against `apps/web/node_modules/next/dist/docs/` before non-trivial routing or config work; older training data may mislead.

## Security Conventions
- **Argon2** for password hashing; never store plaintext.
- **AES-256-GCM** with random IV per stored API key; `ENCRYPTION_KEY` is 32 bytes.
- **`assertSafePath()`** central guard on all file ops (blocks `..`, null bytes, `~`).
- **Rate limiting** via `@fastify/rate-limit` on every service (default 100/min; 5/min on login/register).
- HTTP-only session cookies signed with `COOKIE_SECRET`.
- **Admin gate** is currently `ADMIN_EMAIL` env (MVP); move to a role column for production (DECISIONS / CONCERNS).

## Repo Hygiene
- The repo path may contain spaces — quote shell paths.
- `.gitignore` excludes `infra/docker/.env` — never commit it.
- `services/auth` and `services/workspace` pin **vitest@^4.1.5**; other services pin `^1.4.0`. APIs differ — do not unify casually.
- Stale areas in `README.md` (e.g. `apps/api`, "API at :4000") — trust executable config and source.
