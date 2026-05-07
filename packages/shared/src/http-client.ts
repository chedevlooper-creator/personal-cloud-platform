/**
 * Internal HTTP client factory with automatic retries, timeouts,
 * correlation-id propagation and Bearer / X-User-Id injection.
 *
 * Built on top of `fetch` so no extra HTTP dependency is required.
 */

export interface InternalClientOptions {
  baseUrl: string;
  internalServiceToken: string;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
  /** Max retries for transient failures (exponential backoff). */
  maxRetries?: number;
}

export class ServiceHttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message);
    this.name = 'ServiceHttpError';
  }
}

export interface RequestOptions {
  userId: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  signal?: AbortSignal;
  expectJson?: boolean;
  /** Optional correlation id to propagate across services. */
  correlationId?: string;
}

export function createInternalClient(opts: InternalClientOptions) {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const maxRetries = opts.maxRetries ?? 3;

  async function request<T = unknown>(requestOpts: RequestOptions): Promise<T> {
    const url = new URL(requestOpts.path, opts.baseUrl);
    if (requestOpts.query) {
      for (const [key, value] of Object.entries(requestOpts.query)) {
        if (value === undefined) continue;
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${opts.internalServiceToken}`,
      'X-User-Id': requestOpts.userId,
    };
    if (requestOpts.correlationId) {
      headers['x-correlation-id'] = requestOpts.correlationId;
    }

    let body: string | undefined;
    if (requestOpts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(requestOpts.body);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const signal = requestOpts.signal
      ? AbortSignal.any([requestOpts.signal, controller.signal])
      : controller.signal;

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: requestOpts.method ?? 'GET',
          headers,
          body,
          signal,
        });

        clearTimeout(timeoutId);

        const expectJson = requestOpts.expectJson ?? true;
        if (!response.ok) {
          let errorBody: unknown = null;
          try {
            errorBody = expectJson ? await response.json() : await response.text();
          } catch {
            errorBody = null;
          }
          throw new ServiceHttpError(
            `${requestOpts.method ?? 'GET'} ${url.pathname} failed: ${response.status}`,
            response.status,
            errorBody,
          );
        }

        if (!expectJson) {
          return (await response.text()) as unknown as T;
        }
        if (response.status === 204) {
          return undefined as unknown as T;
        }
        return (await response.json()) as T;
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof ServiceHttpError && err.status < 500) {
          throw err;
        }
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * 2 ** attempt, 10_000);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }

  return { request };
}
