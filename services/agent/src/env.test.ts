import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The agent service decrypts user LLM credentials with AES-256-GCM. The env
 * loader must fail fast in production when ENCRYPTION_KEY is missing/weak,
 * and permit absence in development (decrypt then degrades gracefully).
 */
describe('agent env ENCRYPTION_KEY validation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('throws when ENCRYPTION_KEY is missing in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://x:y@localhost/db';
    process.env.COOKIE_SECRET = 'a'.repeat(32);
    process.env.INTERNAL_SERVICE_TOKEN = 'b'.repeat(32);
    process.env.AUTH_BYPASS = '0';
    process.env.LLM_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-test-openai-key-1234567890abcdef';
    process.env.ENCRYPTION_KEY = '';

    await expect(import('./env')).rejects.toThrow(/ENCRYPTION_KEY/);
  });

  it('throws when ENCRYPTION_KEY is the unsafe development default in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://x:y@localhost/db';
    process.env.COOKIE_SECRET = 'a'.repeat(32);
    process.env.INTERNAL_SERVICE_TOKEN = 'b'.repeat(32);
    process.env.AUTH_BYPASS = '0';
    process.env.LLM_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-test-openai-key-1234567890abcdef';
    process.env.ENCRYPTION_KEY = 'changeme-changeme-changeme-1234';

    await expect(import('./env')).rejects.toThrow(/ENCRYPTION_KEY/);
  });

  it('accepts a strong 32-char ENCRYPTION_KEY in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://x:y@localhost/db';
    process.env.COOKIE_SECRET = 'a'.repeat(32);
    process.env.INTERNAL_SERVICE_TOKEN = 'b'.repeat(32);
    process.env.AUTH_BYPASS = '0';
    process.env.LLM_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-test-openai-key-1234567890abcdef';
    process.env.ENCRYPTION_KEY = 'X9k2Ll7vQ8mZpRtY3wN6cF1jB4hG5dKa';

    const mod = await import('./env');
    expect(mod.env.ENCRYPTION_KEY).toBe('X9k2Ll7vQ8mZpRtY3wN6cF1jB4hG5dKa');
  });

  it('rejects AUTH_BYPASS in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://x:y@localhost/db';
    process.env.COOKIE_SECRET = 'a'.repeat(32);
    process.env.INTERNAL_SERVICE_TOKEN = 'b'.repeat(32);
    process.env.AUTH_BYPASS = '1';
    process.env.LLM_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-test-openai-key-1234567890abcdef';
    process.env.ENCRYPTION_KEY = 'X9k2Ll7vQ8mZpRtY3wN6cF1jB4hG5dKa';

    await expect(import('./env')).rejects.toThrow(/AUTH_BYPASS/);
  });

  it('permits absent ENCRYPTION_KEY in development', async () => {
    process.env.NODE_ENV = 'development';
    process.env.AUTH_BYPASS = '0';
    process.env.ENCRYPTION_KEY = '';

    const mod = await import('./env');
    expect(mod.env.ENCRYPTION_KEY).toBeUndefined();
  });
});
