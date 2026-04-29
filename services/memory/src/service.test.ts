import { describe, it, expect, vi, beforeEach } from 'vitest';
import pino from 'pino';

// Capture the underlying sql object that the service hands to db.execute so we
// can inspect tenant filters (user_id / workspace_id / type) without a real DB.
const executeMock = vi.fn();

vi.mock('@pcp/db/src/client', () => ({
  db: {
    execute: (...args: any[]) => executeMock(...args),
  },
}));

vi.mock('@pcp/db/src/session', () => ({
  validateSessionUserId: vi.fn(),
  verifyUserExists: vi.fn(),
}));

vi.mock('./embeddings/openai', () => ({
  OpenAIEmbeddingProvider: class {
    async generate() {
      return new Array(1536).fill(0);
    }
    async generateBatch(inputs: string[]) {
      return inputs.map(() => new Array(1536).fill(0));
    }
    getDimensions() {
      return 1536;
    }
  },
}));

/** Walk a drizzle SQL object and collect every interpolated param value. */
function collectParams(node: any, out: unknown[] = []): unknown[] {
  if (node === null || node === undefined) return out;
  if (Array.isArray(node)) {
    for (const child of node) collectParams(child, out);
    return out;
  }
  // Primitive interpolations land directly in queryChunks.
  if (typeof node !== 'object') {
    out.push(node);
    return out;
  }
  const proto = Object.getPrototypeOf(node)?.constructor?.name;
  // Static SQL pieces; ignore.
  if (proto === 'StringChunk') return out;
  // drizzle Param wrapper, kept for forward compatibility.
  if ('value' in node && 'encoder' in node) {
    out.push((node as { value: unknown }).value);
    return out;
  }
  // Nested SQL fragments (sql.join, sql`...`).
  if ('queryChunks' in node) {
    collectParams((node as { queryChunks: unknown }).queryChunks, out);
  }
  return out;
}

const logger = pino({ level: 'silent' });

describe('MemoryService', () => {
  beforeEach(() => {
    executeMock.mockReset();
  });

  it('initializes successfully', async () => {
    const { MemoryService } = await import('./service');
    const service = new MemoryService(logger);
    expect(service).toBeDefined();
  });

  it('scopes searchMemory by user_id and forwards type/workspace filters', async () => {
    const { MemoryService } = await import('./service');
    const service = new MemoryService(logger);

    executeMock.mockResolvedValue({ rows: [] });

    const userId = '11111111-1111-1111-1111-111111111111';
    const workspaceId = '22222222-2222-2222-2222-222222222222';
    await service.searchMemory(userId, 'how do I X', {
      type: 'long-term',
      workspaceId,
      limit: 7,
    });

    expect(executeMock).toHaveBeenCalledTimes(1);
    const sqlArg = executeMock.mock.calls[0]?.[0];
    const params = collectParams(sqlArg);

    // user_id and workspace_id must be passed as Params (not concatenated).
    expect(params).toContain(userId);
    expect(params).toContain(workspaceId);
    expect(params).toContain('long-term');
    expect(params).toContain(7);
  });

  it('omits workspace and type filters when not provided', async () => {
    const { MemoryService } = await import('./service');
    const service = new MemoryService(logger);

    executeMock.mockResolvedValue({ rows: [] });

    const userId = '33333333-3333-3333-3333-333333333333';
    await service.searchMemory(userId, 'q');

    const sqlArg = executeMock.mock.calls[0]?.[0];
    const params = collectParams(sqlArg);
    expect(params).toContain(userId);
    // No workspace UUID and no random type string should be present.
    const otherUuid = '44444444-4444-4444-4444-444444444444';
    expect(params).not.toContain(otherUuid);
    expect(params).not.toContain('long-term');
  });

  it('filters out results below minSimilarity', async () => {
    const { MemoryService } = await import('./service');
    const service = new MemoryService(logger);

    executeMock.mockResolvedValue({
      rows: [
        { id: 'a', similarity: 0.95, content: 'high' },
        { id: 'b', similarity: 0.4, content: 'mid' },
        { id: 'c', similarity: -0.1, content: 'low' },
      ],
    });

    const result = await service.searchMemory('user-1', 'q', { minSimilarity: 0.5 });
    expect(result).toEqual([{ id: 'a', similarity: 0.95, content: 'high' }]);
  });

  it('returns all rows when minSimilarity is omitted', async () => {
    const { MemoryService } = await import('./service');
    const service = new MemoryService(logger);

    executeMock.mockResolvedValue({
      rows: [
        { id: 'a', similarity: 0.9 },
        { id: 'b', similarity: 0.1 },
      ],
    });

    const result = await service.searchMemory('user-1', 'q');
    expect(result).toHaveLength(2);
  });
});
