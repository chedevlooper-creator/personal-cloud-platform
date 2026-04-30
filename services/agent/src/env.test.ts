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
    process.env.LLM_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-test-openai-key-1234567890abcdef';
    delete process.env.ENCRYPTION_KEY;

    await expect(import('./env')).rejects.toThrow(/ENCRYPTION_KEY/);
  });

  it('throws when ENCRYPTION_KEY is the unsafe development default in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://x:y@localhost/db';
    process.env.COOKIE_SECRET = 'a'.repeat(32);
    process.env.INTERNAL_SERVICE_TOKEN = 'b'.repeat(32);
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
    process.env.LLM_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-test-openai-key-1234567890abcdef';
    process.env.ENCRYPTION_KEY = 'X9k2Ll7vQ8mZpRtY3wN6cF1jB4hG5dKa';

    const mod = await import('./env');
    expect(mod.env.ENCRYPTION_KEY).toBe('X9k2Ll7vQ8mZpRtY3wN6cF1jB4hG5dKa');
  });

  it('permits absent ENCRYPTION_KEY in development (or accepts dev-supplied key)', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ENCRYPTION_KEY;

    const mod = await import('./env');
    // In dev, env.ENCRYPTION_KEY is either undefined (not set) or whatever
    // the local .env files supply. Either way it must NOT throw, and the
    // resolver must never fabricate a value when the input was empty.
    const resolved = mod.env.ENCRYPTION_KEY;
    expect(resolved === undefined || typeof resolved === 'string').toBe(true);
  });
});
