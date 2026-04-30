/**
 * Minimal Redis-like interface for the rate limiter.
 * Services pass their own IORedis instance; the shared package
 * does not depend on ioredis directly.
 */
export interface RedisLike {
  pipeline(): {
    zremrangebyscore(key: string, min: number | string, max: number | string): void;
    zcard(key: string): void;
    exec(): Promise<([Error | null, unknown] | null)[] | null>;
  };
  zrange(key: string, start: number, stop: number, withScores: string): Promise<string[]>;
  zadd(key: string, score: number, member: string): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<number>;
}

/** In-memory fallback when Redis is unavailable. */
const memoryStore = new Map<string, number[]>();

function memoryCheck(
  key: string,
  windowMs: number,
  maxRequests: number,
  now: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const entries = memoryStore.get(key) ?? [];
  const windowStart = now - windowMs;
  const valid = entries.filter((t) => t > windowStart);

  if (valid.length >= maxRequests) {
    const resetAt = valid[0]! + windowMs;
    return { allowed: false, remaining: 0, resetAt };
  }

  valid.push(now);
  memoryStore.set(key, valid);
  return { allowed: true, remaining: maxRequests - valid.length, resetAt: now + windowMs };
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check a per-user sliding-window rate limit.
 *
 * Uses Redis when a client is provided and connected; falls back to an
 * in-memory Map (counts are lost on service restart).
 */
export async function checkRateLimit(
  userId: string,
  action: string,
  windowMs: number,
  maxRequests: number,
  redis?: RedisLike | null,
): Promise<RateLimitResult> {
  const key = `ratelimit:${userId}:${action}`;
  const now = Date.now();

  if (!redis) {
    return memoryCheck(key, windowMs, maxRequests, now);
  }

  const windowStart = now - windowMs;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zcard(key);
  const results = await pipeline.exec();
  const current =
    Array.isArray(results) && results.length > 1 && results[1] && results[1][1] != null
      ? Number(results[1][1])
      : 0;

  if (current >= maxRequests) {
    const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
    const resetAt = parseInt(oldest[1] ?? '0', 10) + windowMs;
    return { allowed: false, remaining: 0, resetAt };
  }

  await redis.zadd(key, now, `${now}-${Math.random().toString(36).slice(2)}`);
  await redis.pexpire(key, windowMs);

  return { allowed: true, remaining: maxRequests - current - 1, resetAt: now + windowMs };
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}
