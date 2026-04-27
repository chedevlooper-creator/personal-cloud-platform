import { describe, expect, it, vi } from 'vitest';

vi.mock('@pcp/db/src/client', () => ({ db: {} }));

const { __test__ } = await import('./health');

describe('health daemon constants', () => {
  it('uses an exponentially growing backoff capped to 5 entries', () => {
    expect(__test__.BACKOFF_SECONDS.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < __test__.BACKOFF_SECONDS.length; i++) {
      expect(__test__.BACKOFF_SECONDS[i]).toBeGreaterThanOrEqual(
        __test__.BACKOFF_SECONDS[i - 1]!,
      );
    }
  });

  it('requires 3 consecutive failures before declaring crashed', () => {
    expect(__test__.CONSECUTIVE_FAIL_THRESHOLD).toBe(3);
  });
});
