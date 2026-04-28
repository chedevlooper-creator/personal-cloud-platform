import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    query: {
      channelLinks: {
        findFirst: vi.fn(),
      },
      conversations: {
        findFirst: vi.fn(),
      },
      workspaces: {
        findFirst: vi.fn(),
      },
      tasks: {
        findFirst: vi.fn(),
      },
    },
  },
}));

// Mock db client to avoid env validation at module load.
vi.mock('@pcp/db/src/client', () => ({ db: mockDb }));
vi.mock('drizzle-orm', () => ({
  and: (...conditions: unknown[]) => ({ type: 'and', conditions }),
  eq: (column: unknown, value: unknown) => ({ type: 'eq', column, value }),
  isNull: (column: unknown) => ({ type: 'isNull', column }),
  desc: (column: unknown) => ({ type: 'desc', column }),
}));

describe('channels/router constants', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('exposes sane test constants', async () => {
    const mod = await import('./router');
    expect(mod.__test__.POLL_INTERVAL_MS).toBeGreaterThan(0);
    expect(mod.__test__.TASK_TIMEOUT_MS).toBeGreaterThan(mod.__test__.POLL_INTERVAL_MS);
    expect(mod.__test__.TASK_TIMEOUT_MS).toBeLessThanOrEqual(15 * 60 * 1000);
  });

  it('polls task completion by task id and authenticated channel user', async () => {
    const { handleIncoming } = await import('./router');
    const { tasks } = await import('@pcp/db/src/schema');
    let taskWhere: unknown;
    mockDb.query.channelLinks.findFirst.mockResolvedValue({
      id: 'link-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      channel: 'telegram',
      externalId: 'external-user-1',
      enabled: true,
    });
    mockDb.query.conversations.findFirst.mockResolvedValue({
      id: 'conversation-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      channel: 'telegram',
      channelThreadId: 'thread-1',
    });
    mockDb.query.tasks.findFirst.mockImplementation(async (query: { where: unknown }) => {
      taskWhere = query.where;
      return {
        id: 'task-1',
        userId: 'user-1',
        status: 'completed',
        output: 'done',
      };
    });
    const orchestrator = {
      createTask: vi.fn(async () => ({ id: 'task-1' })),
    };
    const adapter = {
      sendReply: vi.fn(async () => undefined),
    };

    await handleIncoming(
      {
        channel: 'telegram',
        externalUserId: 'external-user-1',
        externalThreadId: 'thread-1',
        body: 'hello',
        receivedAt: new Date('2026-04-29T00:00:00.000Z'),
      },
      orchestrator as never,
      adapter,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    );

    expect(adapter.sendReply).toHaveBeenCalledWith('thread-1', 'done');
    expect(predicateContainsEq(taskWhere, tasks.id, 'task-1')).toBe(true);
    expect(predicateContainsEq(taskWhere, tasks.userId, 'user-1')).toBe(true);
  });
});

describe('channels/telegram', () => {
  it('throws when no token provided', async () => {
    const { TelegramAdapter } = await import('./telegram');
    expect(() => new TelegramAdapter('')).toThrow();
  });

  it('fromEnv returns null when env unset', async () => {
    const { TelegramAdapter } = await import('./telegram');
    const orig = process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_TOKEN;
    expect(TelegramAdapter.fromEnv()).toBeNull();
    if (orig) process.env.TELEGRAM_BOT_TOKEN = orig;
  });

  it('truncates long messages and posts to Telegram API', async () => {
    const fetchMock = vi.fn(async () => new Response('{"ok":true}', { status: 200 })) as any;
    const origFetch = global.fetch;
    global.fetch = fetchMock;
    try {
      const { TelegramAdapter } = await import('./telegram');
      const a = new TelegramAdapter('TEST_TOKEN');
      const long = 'a'.repeat(5000);
      await a.sendReply('123', long);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('TEST_TOKEN');
      const body = JSON.parse(init.body);
      expect(body.chat_id).toBe('123');
      expect(body.text.length).toBeLessThanOrEqual(4096);
      expect(body.text).toContain('truncated');
    } finally {
      global.fetch = origFetch;
    }
  });
});

function predicateContainsEq(predicate: unknown, column: unknown, value: unknown): boolean {
  if (!predicate || typeof predicate !== 'object') return false;
  const node = predicate as {
    type?: string;
    column?: unknown;
    value?: unknown;
    conditions?: unknown[];
  };
  if (node.type === 'eq') return node.column === column && node.value === value;
  return node.conditions?.some((child) => predicateContainsEq(child, column, value)) ?? false;
}
