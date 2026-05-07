import IORedis from 'ioredis';
import { RedisCache } from '@pcp/shared';
import { env } from './env';

const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.warn('Redis cache connection error:', err.message);
});

export const cache = new RedisCache(redis);
