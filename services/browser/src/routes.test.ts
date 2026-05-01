import { describe, expect, it } from 'vitest';
import { browserRouteErrorCodeFromStatus } from './routes';

describe('browser route error mapping', () => {
  it('preserves client and rate-limit status codes in the shared API envelope', () => {
    expect(browserRouteErrorCodeFromStatus(400)).toEqual({ statusCode: 400, code: 'BAD_REQUEST' });
    expect(browserRouteErrorCodeFromStatus(401)).toEqual({ statusCode: 401, code: 'UNAUTHORIZED' });
    expect(browserRouteErrorCodeFromStatus(403)).toEqual({ statusCode: 403, code: 'FORBIDDEN' });
    expect(browserRouteErrorCodeFromStatus(404)).toEqual({ statusCode: 404, code: 'NOT_FOUND' });
    expect(browserRouteErrorCodeFromStatus(409)).toEqual({ statusCode: 409, code: 'CONFLICT' });
    expect(browserRouteErrorCodeFromStatus(429)).toEqual({ statusCode: 429, code: 'RATE_LIMITED' });
    expect(browserRouteErrorCodeFromStatus(500)).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
    });
  });
});
