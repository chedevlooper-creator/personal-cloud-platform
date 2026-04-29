import { db } from '@pcp/db/src/client';
import { memoryEntries } from '@pcp/db/src/schema';
import {
  validateSessionUserId,
  verifyUserExists as verifySharedUserExists,
} from '@pcp/db/src/session';
import { eq, and, sql } from 'drizzle-orm';
import { EmbeddingProvider } from './embeddings/types';
import { OpenAIEmbeddingProvider } from './embeddings/openai';
import { LocalHashEmbeddingProvider } from './embeddings/local';
import { env } from './env';

export class MemoryService {
  private embeddings: EmbeddingProvider;

  constructor(private logger: any) {
    const apiKey = env.OPENAI_API_KEY;
    const useRemote =
      apiKey && !apiKey.startsWith('dev-') && !apiKey.toLowerCase().includes('change_me');
    if (useRemote) {
      this.embeddings = new OpenAIEmbeddingProvider(apiKey);
      this.logger.info({ provider: 'openai' }, 'MemoryService initialized');
    } else {
      this.embeddings = new LocalHashEmbeddingProvider(1536);
      this.logger.warn(
        { provider: 'local-hash' },
        'MemoryService using local hash embeddings — set OPENAI_API_KEY for higher recall',
      );
    }
  }

  async validateUserFromCookie(sessionId: string): Promise<string | null> {
    return validateSessionUserId(sessionId);
  }

  async verifyUserExists(userId: string): Promise<string | null> {
    if (!userId) return null;
    return verifySharedUserExists(userId);
  }

  async addMemory(
    userId: string,
    type: string,
    content: string,
    metadata?: any,
    workspaceId?: string,
  ) {
    const embedding = await this.embeddings.generate(content);

    const [memory] = await db
      .insert(memoryEntries)
      .values({
        userId,
        workspaceId: workspaceId || null,
        type,
        content,
        embedding,
        metadata,
      })
      .returning();

    return memory;
  }

  async searchMemory(
    userId: string,
    query: string,
    options?: {
      limit?: number;
      type?: string;
      workspaceId?: string;
      minSimilarity?: number;
    },
  ) {
    const queryEmbedding = await this.embeddings.generate(query);
    const limit = options?.limit ?? 5;
    const minSimilarity = options?.minSimilarity;

    // Formatting embedding vector array as string for raw SQL execution
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Tenant scoping: user_id filter is mandatory; type/workspace narrow further.
    const conditions = [sql`user_id = ${userId}`];
    if (options?.type) conditions.push(sql`type = ${options.type}`);
    if (options?.workspaceId) conditions.push(sql`workspace_id = ${options.workspaceId}`);
    const whereClause = sql.join(conditions, sql` AND `);

    // Ranking uses pgvector L2 distance (`<->`) so the HNSW index from
    // migration 0010 (`vector_l2_ops`) is used. Both embedding providers
    // emit L2-normalized vectors, so for unit-length a, b:
    //   ||a - b||^2 = 2 - 2 * cos(a, b)
    //   => cos(a, b) = 1 - ||a - b||^2 / 2
    // We expose that as `similarity` (range [-1, 1], higher is better).
    const results = await db.execute(sql`
      SELECT id, user_id, workspace_id, type, content, metadata, created_at, updated_at,
             1 - power(embedding <-> ${embeddingStr}::vector, 2) / 2 AS similarity
      FROM memory_entries
      WHERE ${whereClause}
      ORDER BY embedding <-> ${embeddingStr}::vector
      LIMIT ${limit}
    `);

    const rows: any[] = (results as any).rows ?? (results as any) ?? [];
    if (typeof minSimilarity === 'number') {
      return rows.filter(
        (row) => typeof row.similarity === 'number' && row.similarity >= minSimilarity,
      );
    }
    return rows;
  }

  async updateMemory(
    id: string,
    userId: string,
    updates: { content?: string; metadata?: any; type?: string },
  ) {
    const dataToUpdate: any = { updatedAt: new Date() };

    if (updates.content) {
      dataToUpdate.content = updates.content;
      dataToUpdate.embedding = await this.embeddings.generate(updates.content);
    }

    if (updates.metadata) {
      dataToUpdate.metadata = updates.metadata;
    }

    if (updates.type) {
      dataToUpdate.type = updates.type;
    }

    const [updated] = await db
      .update(memoryEntries)
      .set(dataToUpdate)
      .where(and(eq(memoryEntries.id, id), eq(memoryEntries.userId, userId)))
      .returning();

    return updated;
  }

  async deleteMemory(id: string, userId: string) {
    await db
      .delete(memoryEntries)
      .where(and(eq(memoryEntries.id, id), eq(memoryEntries.userId, userId)));
    return { success: true };
  }
}
