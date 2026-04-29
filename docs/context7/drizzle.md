# Drizzle ORM (Postgres) — packages/db

## Schema + relations

```ts
import { pgTable, serial, text, integer, boolean, timestamp, varchar, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('email_idx').on(t.email)]);

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  authorId: integer('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
});

export const usersRelations = relations(users, ({ many }) => ({ posts: many(posts) }));
export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
}));
```

## Postgres.js client + migrations

```ts
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const migrationsClient = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(migrationsClient);
await migrate(db, { migrationsFolder: './src/migrations' });
```

## Relational queries (tenant-scoped)

```ts
const user = await db.query.users.findFirst({
  where: (u, { eq, and }) => and(eq(u.id, userId), eq(u.organizationId, orgId)),
  with: {
    posts: {
      where: (p, { isNotNull }) => isNotNull(p.publishedAt),
      orderBy: (p, { desc }) => [desc(p.publishedAt)],
      limit: 5,
    },
  },
});
```

## Computed/extras

```ts
const rows = await db.query.users.findMany({
  extras: {
    fullName: sql<string>`concat(${users.name}, ' (', ${users.email}, ')')`.as('full_name'),
  },
});
```

## Debug — toSQL

```ts
const q = db.query.users.findFirst().toSQL();
console.log(q.sql, q.params);
```

## Proje notları
- DB sahibi yalnızca `packages/db` — başka servisten direkt schema değişikliği yapma.
- Her sorgu `userId` veya `organizationId` ile filtrelenmeli (security invariant).
- pgvector için `@pcp/db` schema'sında `vector('embedding', { dimensions })` kullan (bkz. pgvector.md).
- Migration: `pnpm --filter @pcp/db generate` → `migrate`.
