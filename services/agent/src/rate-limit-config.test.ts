import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('agent rate limit configuration', () => {
  it('uses the shared Redis-capable limiter for route limits', () => {
    const routeSource = readFileSync(join(process.cwd(), 'src/routes.ts'), 'utf8');
    const limiterSource = readFileSync(join(process.cwd(), 'src/rate-limit.ts'), 'utf8');

    expect(routeSource).toContain('checkAgentRateLimit');
    expect(routeSource).toContain('createRateLimitHeaders');
    expect(limiterSource).toContain('new IORedis(env.REDIS_URL');
    expect(limiterSource).toContain('checkRateLimit(userId, action, windowMs, maxRequests');
  });
});
