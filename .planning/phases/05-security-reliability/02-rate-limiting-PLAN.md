---
phase: 5
plan: 02
name: rate-limiting
objective: Add per-user rate limiting to agent service endpoints
gap_closure: true
autonomous: true
wave: 1
cross_ai: false
files_modified:
  - services/agent/src/index.ts
  - services/agent/src/routes.ts
  - services/agent/src/routes/*.ts
  - packages/shared/src/errors.ts
---

# Plan 05-02: Rate Limiting

## Objective

Prevent abuse by adding per-user rate limits to agent service endpoints. Use Redis-backed sliding window for accurate counting across service restarts.

## Background

Currently the agent service has a global rate limit (`@fastify/rate-limit` with `max: 100` per minute) but no per-user limits. A single user could exhaust the global quota.

## Tasks

### Task 1: Add Redis-based rate limit store (1h)

Create `services/agent/src/rate-limit.ts`:

```ts
import IORedis from 'ioredis';
import { env } from './env';

const redis = new IORedis(env.REDIS_URL);

export async function checkRateLimit(
  userId: string,
  action: string, // e.g., 'chat', 'task', 'tool'
  windowMs: number,
  maxRequests: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = `ratelimit:${userId}:${action}`;
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Remove old entries outside window
  await redis.zremrangebyscore(key, 0, windowStart);
  
  // Count current entries in window
  const current = await redis.zcard(key);
  
  if (current >= maxRequests) {
    const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
    const resetAt = parseInt(oldest[1] ?? '0') + windowMs;
    return { allowed: false, remaining: 0, resetAt };
  }
  
  // Add current request
  await redis.zadd(key, now, `${now}-${Math.random()}`);
  await redis.pexpire(key, windowMs);
  
  return { allowed: true, remaining: maxRequests - current - 1, resetAt: now + windowMs };
}
```

### Task 2: Apply limits to agent routes (1.5h)

Limits:
| Endpoint | Window | Max |
|----------|--------|-----|
| POST /agent/chat | 1 min | 30 |
| POST /agent/tasks | 1 min | 20 |
| POST /agent/tasks/:id/tool-approval | 1 min | 10 |
| GET /agent/tasks/:id/events | 1 min | 60 |
| POST /automations/:id/run | 1 min | 10 |

Add middleware that checks rate limit before route handler. Return 429 with `Retry-After` header if exceeded.

### Task 3: Add rate limit headers (0.5h)

Return standard headers on all agent responses:
```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 27
X-RateLimit-Reset: 1714471200
```

### Task 4: Frontend handling (0.5h)

Update `apps/web/src/lib/api.ts` to handle 429 responses gracefully:
- Show toast: "Rate limit exceeded. Retry in N seconds."
- Disable submit button until reset

### Task 5: Tests (0.5h)

Add tests:
- Rate limit allows requests under limit
- Rate limit blocks requests over limit
- Rate limit resets after window

## Success Criteria

- [ ] Per-user rate limits enforced on all agent endpoints
- [ ] 429 responses include `Retry-After` header
- [ ] Frontend shows user-friendly rate limit messages
- [ ] Tests verify limit behavior
- [ ] `pnpm test` passes

## Deviations

If Redis is unavailable, fall back to in-memory Map with service restart caveats.
