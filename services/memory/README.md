# @pcp/memory-service

Fastify v4 service that owns long-term memory: writes embeddings into
`memory_entries` and serves cosine similarity searches via pgvector.
Port **3005**, routes under `/api`.

## Routes

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/memory/entries` | Create an entry; embeds `content` and stores the vector. |
| `POST` | `/api/memory/search` | Cosine search; tenant-scoped to `userId`. |
| `PATCH` | `/api/memory/entries/:id` | Update content/metadata; re-embeds when content changes. |
| `DELETE` | `/api/memory/entries/:id` | Delete entry. |

Entries carry a `type` of `short-term`, `long-term`, or `episodic` plus
optional `workspaceId`, `taskId`, and `tags[]`.

## Embedding providers

`src/embeddings/`:

- **OpenAI** (`text-embedding-3-small`, 1536 dims) — used when
  `OPENAI_API_KEY` is set to a real key (not `dev-…` and not containing
  `change_me`).
- **Local hash fallback** (`embeddings/local.ts`) — SHA-256 per token
  spread across a 1536-dim Float64Array, signed, L2-normalized. Pure
  TypeScript, no external dependency. Deterministic and good enough for
  development; quality is degraded vs. real embeddings, so prefer OpenAI
  in production.

The provider is selected once at startup based on the env. The dimension
must remain **1536** to match the schema's `vector(1536)` column.

## Database

The pgvector extension is required (`postgres:pgvector` image is wired up
in `infra/docker/docker-compose.yml`). The schema declares a custom
Drizzle type for `vector(1536)` in
[`packages/db/src/schema/memory_entries.ts`](../../packages/db/src/schema/memory_entries.ts).
Migration `0010_memory_vector_index.sql` creates an HNSW index on
`embedding vector_l2_ops` plus btree indexes on `(user_id, type)` and
`(user_id, workspace_id)` to support tenant-filtered nearest-neighbor
search. HNSW is used because it works on empty tables, unlike IVFFlat
(which requires training rows). Both embedding providers emit
L2-normalized vectors, so L2 ranking matches cosine ranking — the
index's `vector_l2_ops` opclass aligns with the runtime `<->` operator.

## Retrieval semantics

`POST /api/memory/search` body:

| Field | Default | Notes |
| --- | --- | --- |
| `query` | required | Embedded once per request. |
| `limit` | `5` (max `50`) | `LIMIT` applied in SQL. |
| `type` | none | Optional `type = ?` filter. |
| `workspaceId` | none | Optional `workspace_id = ?` filter. |
| `minSimilarity` | none | Drops results with `similarity` below the floor. |

- **Tenant scope**: `user_id = ?` is always applied; `type` and
  `workspaceId` narrow further. Drizzle parameters are bound, never
  concatenated.
- **Ordering**: `ORDER BY embedding <-> $vec::vector` (L2 distance,
  ascending). The HNSW index handles this operator on any table size.
- **Similarity score**: returned as `similarity` per row. Because both
  providers emit unit-length vectors,
  `similarity = 1 - ||a − b||² / 2` which equals true cosine similarity
  in `[-1, 1]` (higher is better).
- **Threshold**: `minSimilarity` filters rows after the SQL `LIMIT`. To
  avoid silently empty results pick a value calibrated against your
  embedding provider — `0.2` is reasonable for OpenAI
  `text-embedding-3-small`; the local hash fallback emits much lower
  scores and a threshold may not be useful there.

## Environment

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Selects the OpenAI provider when present and non-dev. |
| `DATABASE_URL` | Postgres + pgvector. |
| `INTERNAL_SERVICE_TOKEN` | Required for agent tool calls. |
| `AUTH_SERVICE_URL` | Cookie session validation. |

## Scripts

```bash
pnpm --filter @pcp/memory-service dev
pnpm --filter @pcp/memory-service build
pnpm --filter @pcp/memory-service test
pnpm --filter @pcp/memory-service typecheck
```
