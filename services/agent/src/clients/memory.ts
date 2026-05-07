import { createInternalClient } from '@pcp/shared';
import { env } from '../env';

const client = createInternalClient({
  baseUrl: env.MEMORY_SERVICE_URL,
  internalServiceToken: env.INTERNAL_SERVICE_TOKEN,
});

export interface MemoryEntry {
  id: string;
  userId: string;
  workspaceId: string | null;
  type: string;
  content: string;
  metadata: unknown;
  createdAt: string | Date;
  similarity?: number;
}

export class MemoryClient {
  async add(
    userId: string,
    type: string,
    content: string,
    options: { metadata?: unknown; workspaceId?: string } = {},
  ): Promise<MemoryEntry> {
    return client.request<MemoryEntry>({
      userId,
      method: 'POST',
      path: '/memory/entries',
      body: {
        type,
        content,
        metadata: options.metadata,
        workspaceId: options.workspaceId,
      },
    });
  }

  async search(
    userId: string,
    query: string,
    options: {
      limit?: number;
      type?: string;
      workspaceId?: string;
      minSimilarity?: number;
    } = {},
  ): Promise<MemoryEntry[]> {
    const result = await client.request<{ results: MemoryEntry[] }>({
      userId,
      method: 'POST',
      path: '/memory/search',
      body: { query, ...options },
    });
    return result.results;
  }
}
