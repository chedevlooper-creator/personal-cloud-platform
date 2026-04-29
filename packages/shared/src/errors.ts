import { z } from 'zod';

export const apiErrorCodeSchema = z.enum([
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'VALIDATION_ERROR',
  'INTERNAL_ERROR',
]);

export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string().min(1),
    correlationId: z.string().min(1).optional(),
  }),
});

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

export function createApiErrorResponse(
  code: ApiErrorCode,
  message: string,
  correlationId?: string,
): ApiErrorResponse {
  return {
    error: {
      code,
      message,
      ...(correlationId ? { correlationId } : {}),
    },
  };
}

/** Map an HTTP status code to the canonical API error code. */
export function apiErrorCodeFromStatus(
  statusCode: number,
  isValidationError = false,
): ApiErrorCode {
  if (isValidationError) return 'VALIDATION_ERROR';
  if (statusCode === 400) return 'BAD_REQUEST';
  if (statusCode === 401) return 'UNAUTHORIZED';
  if (statusCode === 403) return 'FORBIDDEN';
  if (statusCode === 404) return 'NOT_FOUND';
  if (statusCode === 409) return 'CONFLICT';
  return 'INTERNAL_ERROR';
}

export function defaultApiErrorMessage(code: ApiErrorCode): string {
  switch (code) {
    case 'VALIDATION_ERROR':
      return 'Validation failed';
    case 'UNAUTHORIZED':
      return 'Unauthorized';
    case 'FORBIDDEN':
      return 'Forbidden';
    case 'NOT_FOUND':
      return 'Not found';
    case 'CONFLICT':
      return 'Conflict';
    case 'BAD_REQUEST':
      return 'Bad request';
    default:
      return 'Internal server error';
  }
}

/** Clamp arbitrary thrown statusCodes into the 4xx/5xx range. */
export function normalizeApiStatusCode(statusCode: number | undefined): number {
  if (!statusCode || statusCode < 400 || statusCode > 599) return 500;
  return statusCode;
}

/**
 * Build a Fastify-compatible `setErrorHandler` callback that emits the
 * shared `{ error: { code, message, correlationId } }` envelope and never
 * leaks internal error messages on 5xx responses.
 *
 * Usage:
 * ```ts
 * app.setErrorHandler(createApiErrorHandler());
 * ```
 */
export function createApiErrorHandler() {
  return (error: any, request: any, reply: any) => {
    const statusCode = normalizeApiStatusCode(error?.statusCode);
    const code = apiErrorCodeFromStatus(statusCode, Boolean(error?.validation));
    const message =
      statusCode >= 500
        ? defaultApiErrorMessage('INTERNAL_ERROR')
        : error?.message || defaultApiErrorMessage(code);
    const correlationId = request?.id as string | undefined;

    request?.log?.[statusCode >= 500 ? 'error' : 'warn']?.(
      { err: error, correlationId },
      'request failed',
    );

    reply.code(statusCode).send(createApiErrorResponse(code, message, correlationId));
  };
}

/**
 * Send a single API error response. Use from route handlers where Fastify
 * cannot infer status from a thrown Error (e.g. early `return` paths).
 */
export function sendApiError(
  reply: any,
  statusCode: number,
  code: ApiErrorCode,
  message?: string,
  correlationId?: string,
) {
  return reply
    .code(statusCode)
    .send(createApiErrorResponse(code, message ?? defaultApiErrorMessage(code), correlationId));
}
