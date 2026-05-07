import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkRateLimit,
  clearInMemoryRateLimitStore,
  createRateLimitHeaders,
  type RateLimitRedisLike,
} from './rate-limit';

class RedisLikeStore implements RateLimitRedisLike {
  private readonly values = new Map<string, Array<{ member: string; score: number }>>();

  pipeline() {
    const commands: Array<() => [Error | null, unknown]> = [];
    return {
      zremrangebyscore: (key: string, min: number | string, max: number | string) => {
        commands.push(() => {
          const minScore = Number(min);
          const maxScore = Number(max);
          const current = this.values.get(key) ?? [];
          this.values.set(
            key,
            current.filter((entry) => entry.score < minScore || entry.score > maxScore),
          );
          return [null, 1];
        });
      },
      zcard: (key: string) => {
        commands.push(() => [null, this.values.get(key)?.length ?? 0]);
      },
      exec: async () => commands.map((command) => command()),
    };
  }

  async zrange(key: string): Promise<string[]> {
    const entries = [...(this.values.get(key) ?? [])].sort((a, b) => a.score - b.score);
    const first = entries[0];
    return first ? [first.member, String(first.score)] : [];
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    const entries = this.values.get(key) ?? [];
    entries.push({ member, score });
    this.values.set(key, entries);
    return 1;
  }

  async pexpire(): Promise<number> {
    return 1;
  }
}

describe('checkRateLimit', () => {
  beforeEach(() => {
    clearInMemoryRateLimitStore();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T00:00:00.000Z'));
  });

  it('shares counters across callers when Redis is provided', async () => {
    const redis = new RedisLikeStore();

    expect(await checkRateLimit('user-1', 'login', 60_000, 2, redis)).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(await checkRateLimit('user-1', 'login', 60_000, 2, redis)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(await checkRateLimit('user-1', 'login', 60_000, 2, redis)).toMatchObject({
      allowed: false,
      remaining: 0,
    });
  });

  it('falls back to process-local memory when Redis is not provided', async () => {
    expect(await checkRateLimit('user-1', 'chat', 60_000, 1)).toMatchObject({ allowed: true });
    expect(await checkRateLimit('user-1', 'chat', 60_000, 1)).toMatchObject({ allowed: false });
  });

  it('formats rate-limit headers for services', () => {
    expect(
      createRateLimitHeaders(
        { allowed: false, remaining: 0, resetAt: Date.parse('2026-05-08T00:00:30.000Z') },
        5,
        Date.parse('2026-05-08T00:00:00.000Z'),
      ),
    ).toEqual({
      'X-RateLimit-Limit': '5',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': '1778198430',
      'Retry-After': '30',
    });
  });
});
