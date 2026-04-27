import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock db client to avoid env validation at module load.
vi.mock('@pcp/db/src/client', () => ({ db: {} }));

describe('channels/router constants', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exposes sane test constants', async () => {
    const mod = await import('./router');
    expect(mod.__test__.POLL_INTERVAL_MS).toBeGreaterThan(0);
    expect(mod.__test__.TASK_TIMEOUT_MS).toBeGreaterThan(mod.__test__.POLL_INTERVAL_MS);
    expect(mod.__test__.TASK_TIMEOUT_MS).toBeLessThanOrEqual(15 * 60 * 1000);
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
