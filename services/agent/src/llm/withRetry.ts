interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryableStatusCodes?: number[];
  retryableCodes?: string[];
  logger?: { warn: (...args: unknown[]) => void };
  label?: string;
}

function isRetryableError(
  error: unknown,
  statusCodes: number[],
  errorCodes: string[],
): boolean {
  if (error instanceof Error) {
    const code = (error as Error & { code?: unknown }).code;
    if (typeof code === 'string' && errorCodes.includes(code)) {
      return true;
    }
  }

  const status = typeof error === 'object' && error !== null ? (error as { status?: unknown }).status : undefined;
  if (typeof status === 'number' && statusCodes.includes(status)) {
    return true;
  }

  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 32000,
    retryableStatusCodes = [429, 500, 502, 503, 504],
    retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND'],
    logger,
    label,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      if (!isRetryableError(error, retryableStatusCodes, retryableCodes)) {
        throw error;
      }

      const backoffMs = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      const jitteredMs = backoffMs + Math.random() * backoffMs * 0.5;

      logger?.warn(
        { attempt: attempt + 1, maxRetries, delayMs: Math.round(jitteredMs), label },
        'LLM call failed, retrying',
      );

      await delay(jitteredMs);
    }
  }

  throw lastError;
}
