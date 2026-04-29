import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockDb, insertMock } = vi.hoisted(() => {
  const insertMock = vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(async () => [
        {
          id: 'link-1',
          workspaceId: 'workspace-1',
          channel: 'telegram',
          externalId: 'external-user-1',
          label: null,
          enabled: true,
          metadata: null,
          createdAt: new Date('2026-04-29T00:00:00.000Z'),
          updatedAt: new Date('2026-04-29T00:00:00.000Z'),
        },
      ]),
    })),
  }));
  const mockDb = {
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
      sessions: {
        findFirst: vi.fn(),
      },
      users: {
        findFirst: vi.fn(),
      },
    },
    insert: insertMock,
  };
  return { mockDb, insertMock };
});

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
    mockDb.query.workspaces.findFirst.mockResolvedValue({
      id: 'workspace-1',
      userId: 'user-1',
      deletedAt: null,
    });
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
      kind: 'telegram' as const,
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

  it('does not expose another tenant task output when polling a channel reply', async () => {
    const { handleIncoming } = await import('./router');
    const { tasks } = await import('@pcp/db/src/schema');
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
      if (predicateContainsEq(query.where, tasks.id, 'task-1')) {
        if (predicateContainsEq(query.where, tasks.userId, 'user-1')) return null;
        return {
          id: 'task-1',
          userId: 'user-2',
          status: 'completed',
          output: 'other tenant output',
        };
      }
      return null;
    });
    const orchestrator = {
      createTask: vi.fn(async () => ({ id: 'task-1' })),
    };
    const adapter = {
      kind: 'telegram' as const,
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

    expect(adapter.sendReply).toHaveBeenCalledWith('thread-1', 'Task kayboldu, tekrar dene.');
    expect(adapter.sendReply).not.toHaveBeenCalledWith('thread-1', 'other tenant output');
  });

  it('does not create a task when a linked workspace is not owned by the channel user', async () => {
    const { handleIncoming } = await import('./router');
    mockDb.query.channelLinks.findFirst.mockResolvedValue({
      id: 'link-1',
      userId: 'user-1',
      workspaceId: 'workspace-2',
      channel: 'telegram',
      externalId: 'external-user-1',
      enabled: true,
    });
    mockDb.query.workspaces.findFirst.mockResolvedValue(null);
    const orchestrator = {
      createTask: vi.fn(async () => ({ id: 'task-1' })),
    };
    const adapter = {
      kind: 'telegram' as const,
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

    expect(orchestrator.createTask).not.toHaveBeenCalled();
    expect(adapter.sendReply).toHaveBeenCalledWith(
      'thread-1',
      'Bu kanalın workspace bağlantısı geçersiz. Web arayüzünden bağlantıyı güncelleyin.',
    );
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

describe('channels routes workspace ownership', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockDb.query.sessions.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockDb.query.users.findFirst.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440001' });
    mockDb.query.channelLinks.findFirst.mockResolvedValue(null);
  });

  it('rejects channel links for unowned workspaces', async () => {
    const Fastify = (await import('fastify')).default;
    const cookie = (await import('@fastify/cookie')).default;
    const { serializerCompiler, validatorCompiler } = await import('fastify-type-provider-zod');
    const { setupChannelsRoutes } = await import('../routes/channels');
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(cookie);
    await setupChannelsRoutes(app);
    mockDb.query.workspaces.findFirst.mockResolvedValueOnce(null);

    const response = await app.inject({
      method: 'POST',
      url: '/channels/links',
      headers: { cookie: 'sessionId=session-1' },
      payload: {
        channel: 'telegram',
        externalId: 'external-user-1',
        workspaceId: '550e8400-e29b-41d4-a716-446655440003',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(insertMock).not.toHaveBeenCalled();

    await app.close();
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
