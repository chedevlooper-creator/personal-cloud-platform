# Conventions

Last mapped: 2026-04-27

## Code Style

### Formatting (Prettier)
- **Single quotes**: yes
- **Semicolons**: yes
- **Print width**: 100
- **Tab width**: 2 (spaces)
- **Trailing commas**: all
- **Arrow parens**: always
- **End of line**: LF
- Config: `.prettierrc`

### TypeScript Strictness
- `strict: true`
- `noImplicitAny: true`
- `strictNullChecks: true`
- `noUncheckedIndexedAccess: true` — array/index access yields `T | undefined`
- `noImplicitOverride: true`
- `noFallthroughCasesInSwitch: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `isolatedModules: true`

## Naming Patterns

### Files
- **Components**: kebab-case (`sidebar-item.tsx`, `command-palette.tsx`)
- **Schema files**: snake_case (`workspace_files.ts`, `audit_logs.ts`)
- **Service code**: camelCase or descriptive (`service.ts`, `routes.ts`, `orchestrator.ts`)

### Code
- **Classes**: PascalCase (`AuthService`, `AgentOrchestrator`, `DockerProvider`)
- **Functions**: camelCase (`createLLMProvider`, `validateUserFromCookie`)
- **Types/Interfaces**: PascalCase (`LLMProvider`, `RuntimeProvider`, `WorkspaceObjectStorage`)
- **DB tables**: snake_case via Drizzle (`pgTable('workspace_files', ...)`)
- **DB columns**: snake_case in SQL, camelCase in TypeScript (`storageUsed` → `storage_used`)
- **Env vars**: SCREAMING_SNAKE_CASE (`DATABASE_URL`, `LLM_PROVIDER`)

## Service Bootstrap Pattern

Every backend service follows the same bootstrap pattern in `index.ts`:

```typescript
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

const server = Fastify({ logger: { transport: ... } });
server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);
server.register(cors, { origin: true, credentials: true });
server.register(cookie, { secret: '...' });
server.get('/health', async () => ({ status: 'ok', service: 'name' }));
server.register(setupRoutes, { prefix: '/path' });

const start = async () => {
  const port = process.env.PORT ? parseInt(process.env.PORT) : XXXX;
  await server.listen({ port, host: '0.0.0.0' });
};
start();
```

## Service Class Pattern

Business logic lives in a single service class per service:

```typescript
export class ServiceName {
  constructor(private logger: any) {}

  async validateUserFromCookie(sessionId: string): Promise<string | null> {
    // Session validation — duplicated across services
  }

  async methodName(userId: string, ...args) {
    // Business logic with direct Drizzle queries
  }
}
```

### Key observations:
- **Logger injection**: `private logger: any` (untyped pino)
- **Session validation**: duplicated `validateUserFromCookie` in every service class
- **DB access**: direct Drizzle queries in service methods (no separate repository layer)
- **Error handling**: throwing plain `Error` with message

## Route Registration Pattern

```typescript
export async function setupRoutes(server: FastifyInstance) {
  server.post('/endpoint', { schema: { body: ZodSchema } }, async (request, reply) => {
    const service = new Service(server.log);
    // Validate session, call service, return response
  });
}
```

## Database Schema Pattern

Drizzle `pgTable` with UUID primary keys, timestamps:

```typescript
export const tableName = pgTable('table_name', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // ... domain columns
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'), // soft delete where applicable
});
```

## Error Handling

- **Custom errors**: `WorkspaceError` extends `Error` with `statusCode` (workspace service)
- **Other services**: throw plain `Error` with descriptive message
- **Fastify**: default error serialization (no global error handler configured)
- **Logging**: `this.logger.error({ err, context }, 'message')` — structured pino

## Import Patterns

### Internal packages (workspace references)
```typescript
import { db } from '@pcp/db/src/client';
import { users, sessions } from '@pcp/db/src/schema';
```

### Shared DTOs
```typescript
import { SomeType } from '@pcp/shared';
```
Note: `@pcp/shared` has no build step — imports from `src/` directly.

## Frontend Patterns

### Component Pattern
- `'use client'` directive for interactive components
- Props destructured in function signature
- Lucide icons for UI
- `cn()` utility for conditional classnames (clsx + tailwind-merge)

### State Management
- **Server state**: TanStack React Query via axios API calls
- **Client state**: Zustand stores (`store/workspace.ts`)
- **URL state**: Next.js routing (App Router with route groups)

### Route Groups
- `(auth)` — login, register (unauthenticated)
- `(main)` — dashboard, workspace, etc. (authenticated shell)
