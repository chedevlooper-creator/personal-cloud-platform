# pgvector — services/memory, packages/db

## Extension + table

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE memory_items (
  id bigserial PRIMARY KEY,
  user_id integer NOT NULL,
  workspace_id integer,
  embedding vector(1536),
  text text,
  created_at timestamp NOT NULL DEFAULT now()
);
```

## HNSW (önerilen) ve IVFFlat indexler

```sql
-- L2
CREATE INDEX ON memory_items USING hnsw (embedding vector_l2_ops);
-- Cosine
CREATE INDEX ON memory_items USING hnsw (embedding vector_cosine_ops);
-- Inner product
CREATE INDEX ON memory_items USING hnsw (embedding vector_ip_ops);
-- Custom params
CREATE INDEX ON memory_items USING hnsw (embedding vector_l2_ops) WITH (m = 16, ef_construction = 64);
-- Concurrent (no write blocking)
CREATE INDEX CONCURRENTLY ON memory_items USING hnsw (embedding vector_l2_ops);

-- IVFFlat (build hızlı, daha az RAM)
CREATE INDEX ON memory_items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- lists önerisi: <1M satır → rows/1000, >1M → sqrt(rows)
```

## Filtered search (tenant + category)

```sql
-- Basit B-tree + HNSW
CREATE INDEX ON memory_items (user_id);
CREATE INDEX ON memory_items USING hnsw (embedding vector_l2_ops) WHERE user_id = 123;

-- Sorgu
SELECT id, text
FROM memory_items
WHERE user_id = $1
ORDER BY embedding <-> $2::vector
LIMIT 10;
```

## Drizzle ORM ile (`drizzle-orm/pg-core` + `pgvector-node`)

```ts
import { pgTable, serial, integer, text } from 'drizzle-orm/pg-core';
import { vector } from 'drizzle-orm/pg-core';

export const memoryItems = pgTable('memory_items', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  text: text('text'),
  embedding: vector('embedding', { dimensions: 1536 }),
});

// Migration init
await client`CREATE EXTENSION IF NOT EXISTS vector`;
```

## Drizzle ile insert + nearest neighbor

```ts
import { l2Distance, cosineDistance, eq } from 'drizzle-orm';

await db.insert(memoryItems).values([
  { userId, text: 'a', embedding: [0.01, 0.02, /* ... */] },
]);

const top = await db.select()
  .from(memoryItems)
  .where(eq(memoryItems.userId, userId))
  .orderBy(cosineDistance(memoryItems.embedding, queryEmbedding))
  .limit(5);
```

## Subvector index (yüksek boyutlu, partial similarity)

```sql
CREATE INDEX ON memory_items USING hnsw ((subvector(embedding, 1, 256)::vector(256)) vector_cosine_ops);

-- Coarse-then-rerank
SELECT * FROM (
  SELECT * FROM memory_items
  ORDER BY subvector(embedding, 1, 256)::vector(256) <=> subvector($1::vector, 1, 256)
  LIMIT 100
) t
ORDER BY embedding <=> $1::vector
LIMIT 10;
```

## Proje notları
- `services/memory` her sorguda **`user_id`** filtresi koymak zorunda.
- HNSW canlı yazıya engel olmadan eklemek için `CONCURRENTLY` ile build et.
- `ef_search` runtime'da arttırılır: `SET hnsw.ef_search = 100;`
- Postgres image'i `pgvector/pgvector:pg16` (infra/docker'da zaten ayarlı).
