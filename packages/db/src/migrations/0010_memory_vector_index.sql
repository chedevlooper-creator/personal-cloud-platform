-- Memory: indexes for tenant-filtered vector search.
--
-- Search path uses `embedding <-> $vec::vector` (L2 distance). Since both
-- OpenAI text-embedding-3-small and the local-hash fallback emit
-- L2-normalized vectors, L2 ranking is monotonic with cosine ranking.
-- HNSW with vector_l2_ops therefore matches the runtime operator and works
-- on empty tables (unlike IVFFlat, which requires rows to train).

CREATE INDEX IF NOT EXISTS "memory_entries_embedding_hnsw_idx"
  ON "memory_entries"
  USING hnsw ("embedding" vector_l2_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_entries_user_type_idx"
  ON "memory_entries" ("user_id", "type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_entries_user_workspace_idx"
  ON "memory_entries" ("user_id", "workspace_id");
