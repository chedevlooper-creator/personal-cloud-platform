/**
 * Lightweight circuit-breaker implementation.
 *
 * States:
 * - CLOSED: requests pass through; failures increment a counter.
 * - OPEN: after `failureThreshold` failures within `windowMs`, all
 *   requests throw immediately for `openDurationMs`.
 * - HALF_OPEN: after `openDurationMs`, one probe request is allowed.
 *   If it succeeds the breaker closes; otherwise it re-opens.
 */

export interface CircuitBreakerOptions {
  name: string;
  /** Number of consecutive failures required to open the circuit. */
  failureThreshold?: number;
  /** Time window in ms for counting failures (default 60s). */
  windowMs?: number;
  /** How long the circuit stays open before allowing a probe (default 30s). */
  openDurationMs?: number;
}

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreaker {
  execute<T>(fn: () => Promise<T>): Promise<T>;
  getState(): CircuitState;
}

export function createCircuitBreaker(options: CircuitBreakerOptions): CircuitBreaker {
  const failureThreshold = options.failureThreshold ?? 5;
  const windowMs = options.windowMs ?? 60_000;
  const openDurationMs = options.openDurationMs ?? 30_000;

  let state: CircuitState = 'CLOSED';
  let failures: number[] = [];
  let openedAt = 0;

  function recordFailure() {
    const now = Date.now();
    failures = failures.filter((t) => now - t < windowMs);
    failures.push(now);
    if (failures.length >= failureThreshold) {
      state = 'OPEN';
      openedAt = now;
    }
  }

  function recordSuccess() {
    failures = [];
    state = 'CLOSED';
  }

  return {
    getState() {
      if (state === 'OPEN' && Date.now() - openedAt >= openDurationMs) {
        state = 'HALF_OPEN';
      }
      return state;
    },
    async execute<T>(fn: () => Promise<T>): Promise<T> {
      const current = this.getState();
      if (current === 'OPEN') {
        throw new Error(`Circuit breaker "${options.name}" is OPEN`);
      }

      try {
        const result = await fn();
        recordSuccess();
        return result;
      } catch (err) {
        recordFailure();
        throw err;
      }
    },
  };
}
