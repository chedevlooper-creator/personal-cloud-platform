import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('auth rate limit configuration', () => {
  it('uses Redis-backed storage when REDIS_URL is configured', () => {
    const source = readFileSync(join(process.cwd(), 'src/index.ts'), 'utf8');
    expect(source).toContain('new IORedis(process.env.REDIS_URL)');
    expect(source).toContain('redis: rateLimitRedis');
  });
});
