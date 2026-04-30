import IORedis from 'ioredis';
import { env } from './env';

let redis: IORedis | null = null;
let redisAvailable = false;

try {
  redis = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
  redis.on('connect', () => {
    redisAvailable = true;
  });
  redis.on('error', (err) => {
    redisAvailable = false;
    // eslint-disable-next-line no-console
    console.warn('Redis rate-limit connection error, falling back to memory:', err.message);
  });
} catch {
  redisAvailable = false;
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
 * Uses Redis when available; falls back to an in-memory Map
 * (counts are lost on service restart).
 */
export async function checkRateLimit(
  userId: string,
  action: string,
  windowMs: number,
  maxRequests: number,
): Promise<RateLimitResult> {
  const key = `ratelimit:${userId}:${action}`;
  const now = Date.now();

  if (!redis || !redisAvailable) {
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

/** Pre-configured limits for agent service endpoints. */
export const AGENT_RATE_LIMITS = {
  chat: { windowMs: 60_000, maxRequests: 30 },
  taskCreate: { windowMs: 60_000, maxRequests: 20 },
  toolApproval: { windowMs: 60_000, maxRequests: 10 },
  events: { windowMs: 60_000, maxRequests: 60 },
  automationRun: { windowMs: 60_000, maxRequests: 10 },
} as const;
