import { env } from '../env';

export interface InternalRequestOptions {
  userId: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  signal?: AbortSignal;
  expectJson?: boolean;
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

export async function internalRequest<T = unknown>(
  baseUrl: string,
  opts: InternalRequestOptions,
): Promise<T> {
  const url = new URL(opts.path, baseUrl);
  if (opts.query) {
    for (const [key, value] of Object.entries(opts.query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.INTERNAL_SERVICE_TOKEN}`,
    'X-User-Id': opts.userId,
  };
  let body: string | undefined;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  const response = await fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body,
    signal: opts.signal,
  });

  const expectJson = opts.expectJson ?? true;
  if (!response.ok) {
    let errorBody: unknown = null;
    try {
      errorBody = expectJson ? await response.json() : await response.text();
    } catch {
      errorBody = null;
    }
    throw new ServiceHttpError(
      `${opts.method ?? 'GET'} ${url.pathname} failed: ${response.status}`,
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
}
