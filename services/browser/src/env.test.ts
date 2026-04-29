import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalEnv = process.env;

describe('browser env validation', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('rejects dummy production cookie secrets without exposing the value', async () => {
    process.env = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/pcp',
      COOKIE_SECRET: 'dummy-cookie-secret-with-enough-length',
      INTERNAL_SERVICE_TOKEN: 'secure-internal-service-token-0001',
    };

    await expect(import('./env')).rejects.toThrow(
      'COOKIE_SECRET must be set to a non-default value in production',
    );
  });
});
