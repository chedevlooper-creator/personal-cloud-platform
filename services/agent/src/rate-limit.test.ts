import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAgentRateLimit, AGENT_RATE_LIMITS } from './rate-limit';

// Use the in-memory fallback by default (no Redis in unit tests)
describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('allows requests under the limit', async () => {
    const result = await checkAgentRateLimit('user-1', 'chat', 60_000, 5);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('blocks requests over the limit', async () => {
    const { windowMs, maxRequests } = AGENT_RATE_LIMITS.chat;
    for (let i = 0; i < maxRequests; i++) {
      await checkAgentRateLimit('user-1', 'chat', windowMs, maxRequests);
    }
    const result = await checkAgentRateLimit('user-1', 'chat', windowMs, maxRequests);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('resets the window after expiry', async () => {
    const { windowMs, maxRequests } = AGENT_RATE_LIMITS.chat;
    for (let i = 0; i < maxRequests; i++) {
      await checkAgentRateLimit('user-1', 'chat', windowMs, maxRequests);
    }

    let result = await checkAgentRateLimit('user-1', 'chat', windowMs, maxRequests);
    expect(result.allowed).toBe(false);

    vi.advanceTimersByTime(windowMs + 1);

    result = await checkAgentRateLimit('user-1', 'chat', windowMs, maxRequests);
    expect(result.allowed).toBe(true);
  });

  it('isolates limits per user and action', async () => {
    const { windowMs, maxRequests } = AGENT_RATE_LIMITS.chat;
    for (let i = 0; i < maxRequests; i++) {
      await checkAgentRateLimit('user-1', 'chat', windowMs, maxRequests);
    }

    const blocked = await checkAgentRateLimit('user-1', 'chat', windowMs, maxRequests);
    expect(blocked.allowed).toBe(false);

    const otherAction = await checkAgentRateLimit('user-1', 'taskCreate', windowMs, maxRequests);
    expect(otherAction.allowed).toBe(true);

    const otherUser = await checkAgentRateLimit('user-2', 'chat', windowMs, maxRequests);
    expect(otherUser.allowed).toBe(true);
  });
});
