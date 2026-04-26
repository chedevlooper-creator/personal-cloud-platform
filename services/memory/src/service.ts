import { db } from '@pcp/db/src/client';
import { memoryEntries, users, sessions } from '@pcp/db/src/schema';
import { eq, and, sql } from 'drizzle-orm';
import { EmbeddingProvider } from './embeddings/types';
import { OpenAIEmbeddingProvider } from './embeddings/openai';

export class MemoryService {
  private embeddings: EmbeddingProvider;

  constructor(private logger: any) {
    this.embeddings = new OpenAIEmbeddingProvider(process.env.OPENAI_API_KEY || 'dummy_key');
    this.logger.info('MemoryService initialized');
  }

  async validateUserFromCookie(sessionId: string): Promise<string | null> {
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session || session.expiresAt.getTime() < Date.now()) {
      return null;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    });

    return user?.id || null;
  }

  async addMemory(userId: string, type: string, content: string, metadata?: any, workspaceId?: string) {
    const embedding = await this.embeddings.generate(content);

    const [memory] = await db.insert(memoryEntries).values({
      userId,
      workspaceId: workspaceId || null,
      type,
      content,
      embedding,
      metadata,
    }).returning();

    return memory;
  }

  async searchMemory(userId: string, query: string, options?: { limit?: number, type?: string, workspaceId?: string }) {
    const queryEmbedding = await this.embeddings.generate(query);
    const limit = options?.limit || 5;
    
    // Formatting embedding vector array as string for raw SQL execution
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Constructing dynamic SQL query
    let conditions = [sql`user_id = ${userId}`];
    
    if (options?.type) {
      conditions.push(sql`type = ${options.type}`);
    }
    
    if (options?.workspaceId) {
      conditions.push(sql`workspace_id = ${options.workspaceId}`);
    }

    const whereClause = sql.join(conditions, sql` AND `);

    // Using exact cosine distance with <-> operator from pgvector
    const results = await db.execute(sql`
      SELECT id, user_id, workspace_id, type, content, metadata, created_at, updated_at,
             1 - (embedding <-> ${embeddingStr}::vector) as similarity
      FROM memory_entries
      WHERE ${whereClause}
      ORDER BY embedding <-> ${embeddingStr}::vector
      LIMIT ${limit}
    `);

    return (results as any).rows || results;
  }

  async updateMemory(id: string, userId: string, updates: { content?: string, metadata?: any, type?: string }) {
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

    const [updated] = await db.update(memoryEntries)
      .set(dataToUpdate)
      .where(and(eq(memoryEntries.id, id), eq(memoryEntries.userId, userId)))
      .returning();

    return updated;
  }

  async deleteMemory(id: string, userId: string) {
    await db.delete(memoryEntries)
      .where(and(eq(memoryEntries.id, id), eq(memoryEntries.userId, userId)));
    return { success: true };
  }
}
