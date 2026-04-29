import axios, { type AxiosInstance } from 'axios';
import { toast } from 'sonner';

export const apiEndpoints = {
  auth: process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:3001/auth',
  workspace: process.env.NEXT_PUBLIC_WORKSPACE_API_URL || 'http://localhost:3002/api',
  agent: process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:3004/api',
  publish: process.env.NEXT_PUBLIC_PUBLISH_API_URL || 'http://localhost:3006/publish',
  browser: process.env.NEXT_PUBLIC_BROWSER_API_URL || 'http://localhost:3007/api',
};

/**
 * Lightweight typed wrapper around the shared backend error envelope
 * `{ error: { code, message, correlationId } }`. Components/toasts can
 * pattern-match on `apiError.code` instead of stringly-typed messages,
 * and surface `correlationId` for support.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Attach `x-correlation-id` on every outbound request and translate the
 *  shared error envelope into a typed {@link ApiError}. Safe to call once
 *  per axios instance. */
function installInterceptors(client: AxiosInstance) {
  client.interceptors.request.use((config) => {
    const headers = config.headers ?? {};
    if (!headers['x-correlation-id']) {
      // axios v1 typed headers helper, falls back to plain assignment.
      if (typeof (headers as { set?: (k: string, v: string) => void }).set === 'function') {
        (headers as { set: (k: string, v: string) => void }).set(
          'x-correlation-id',
          generateCorrelationId(),
        );
      } else {
        (headers as Record<string, string>)['x-correlation-id'] = generateCorrelationId();
      }
    }
    config.headers = headers;
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status ?? 0;
        const data = error.response?.data as
          | { error?: { code?: string; message?: string; correlationId?: string } | string }
          | undefined;
        const headerCorrelationId = error.response?.headers?.['x-correlation-id'];

        if (data && typeof data.error === 'object' && data.error !== null) {
          const env = data.error;
          throw new ApiError(
            env.message || error.message || 'Request failed',
            env.code || 'INTERNAL_ERROR',
            status,
            env.correlationId ||
              (typeof headerCorrelationId === 'string' ? headerCorrelationId : undefined),
          );
        }
        if (data && typeof data.error === 'string') {
          throw new ApiError(
            data.error,
            'INTERNAL_ERROR',
            status,
            typeof headerCorrelationId === 'string' ? headerCorrelationId : undefined,
          );
        }
      }
      throw error;
    },
  );

  return client;
}

export const authApi = installInterceptors(
  axios.create({
    baseURL: apiEndpoints.auth,
    withCredentials: true,
  }),
);

export const workspaceApi = installInterceptors(
  axios.create({
    baseURL: apiEndpoints.workspace,
    withCredentials: true,
  }),
);

export const agentApi = installInterceptors(
  axios.create({
    baseURL: apiEndpoints.agent,
    withCredentials: true,
  }),
);

export const runtimeApi = installInterceptors(
  axios.create({
    baseURL: process.env.NEXT_PUBLIC_RUNTIME_API_URL || 'http://localhost:3003/api',
    withCredentials: true,
  }),
);

export const publishApi = installInterceptors(
  axios.create({
    baseURL: apiEndpoints.publish,
    withCredentials: true,
  }),
);

export const browserApi = installInterceptors(
  axios.create({
    baseURL: apiEndpoints.browser,
    withCredentials: true,
  }),
);

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message || fallback;
  }
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { error?: string | { message?: string }; message?: string }
      | undefined;
    if (data && typeof data.error === 'object') {
      return data.error.message || data.message || fallback;
    }
    return data?.message || (typeof data?.error === 'string' ? data.error : fallback);
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}

/** Returns `correlationId` if the error came from the API envelope. Useful
 *  for surfacing the trace id in error toasts so support can grep logs. */
export function getApiErrorCorrelationId(error: unknown): string | undefined {
  if (error instanceof ApiError) return error.correlationId;
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { error?: { correlationId?: string } }
      | undefined;
    if (data && typeof data.error === 'object') return data.error.correlationId;
    const header = error.response?.headers?.['x-correlation-id'];
    if (typeof header === 'string') return header;
  }
  return undefined;
}

/** Show an error toast for an API failure, surfacing the correlation id
 *  as the description so support can grep server logs. */
export function toastApiError(error: unknown, fallback: string): void {
  const message = getApiErrorMessage(error, fallback);
  const correlationId = getApiErrorCorrelationId(error);
  toast.error(message, correlationId ? { description: `Trace ID: ${correlationId}` } : undefined);
}
