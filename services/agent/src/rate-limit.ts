import IORedis from 'ioredis';
import { checkRateLimit, type RateLimitResult } from '@pcp/shared';
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

export { RateLimitResult };

export async function checkAgentRateLimit(
  userId: string,
  action: string,
  windowMs: number,
  maxRequests: number,
): Promise<RateLimitResult> {
  return checkRateLimit(userId, action, windowMs, maxRequests, redisAvailable ? redis : undefined);
}

/** Pre-configured limits for agent service endpoints. */
export const AGENT_RATE_LIMITS = {
  chat: { windowMs: 60_000, maxRequests: 30 },
  taskCreate: { windowMs: 60_000, maxRequests: 20 },
  toolApproval: { windowMs: 60_000, maxRequests: 10 },
  events: { windowMs: 60_000, maxRequests: 60 },
  automationRun: { windowMs: 60_000, maxRequests: 10 },
} as const;
