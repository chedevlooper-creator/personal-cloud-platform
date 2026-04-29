import { describe, it, expect } from 'vitest';
import {
  apiErrorCodeFromStatus,
  createApiErrorHandler,
  createApiErrorResponse,
  defaultApiErrorMessage,
  normalizeApiStatusCode,
  sendApiError,
} from '@pcp/shared';

function makeReply() {
  return {
    statusCode: 0,
    body: undefined as unknown,
    code(c: number) {
      this.statusCode = c;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

function makeRequest(id = 'req-1') {
  const events: Array<{ level: string; payload: unknown; msg: string }> = [];
  return {
    id,
    log: {
      events,
      error: (payload: unknown, msg: string) => events.push({ level: 'error', payload, msg }),
      warn: (payload: unknown, msg: string) => events.push({ level: 'warn', payload, msg }),
    },
  };
}

describe('shared API error helpers', () => {
  it('maps HTTP statuses to canonical error codes', () => {
    expect(apiErrorCodeFromStatus(400)).toBe('BAD_REQUEST');
    expect(apiErrorCodeFromStatus(401)).toBe('UNAUTHORIZED');
    expect(apiErrorCodeFromStatus(403)).toBe('FORBIDDEN');
    expect(apiErrorCodeFromStatus(404)).toBe('NOT_FOUND');
    expect(apiErrorCodeFromStatus(409)).toBe('CONFLICT');
    expect(apiErrorCodeFromStatus(500)).toBe('INTERNAL_ERROR');
    expect(apiErrorCodeFromStatus(400, true)).toBe('VALIDATION_ERROR');
  });

  it('clamps unknown status codes to 500', () => {
    expect(normalizeApiStatusCode(undefined)).toBe(500);
    expect(normalizeApiStatusCode(0)).toBe(500);
    expect(normalizeApiStatusCode(200)).toBe(500);
    expect(normalizeApiStatusCode(404)).toBe(404);
    expect(normalizeApiStatusCode(700)).toBe(500);
  });

  it('returns the canonical envelope from createApiErrorResponse', () => {
    expect(createApiErrorResponse('NOT_FOUND', 'missing', 'cid-1')).toEqual({
      error: { code: 'NOT_FOUND', message: 'missing', correlationId: 'cid-1' },
    });
    expect(createApiErrorResponse('NOT_FOUND', 'missing')).toEqual({
      error: { code: 'NOT_FOUND', message: 'missing' },
    });
  });

  it('hides 5xx error messages and uses warn-level for 4xx', () => {
    const handler = createApiErrorHandler();
    const reply500 = makeReply();
    const req500 = makeRequest('cid-500');
    handler({ message: 'boom internals', statusCode: 500 }, req500, reply500);
    expect(reply500.statusCode).toBe(500);
    expect(reply500.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error', correlationId: 'cid-500' },
    });
    expect(req500.log.events.some((e) => e.level === 'error')).toBe(true);

    const reply404 = makeReply();
    const req404 = makeRequest('cid-404');
    handler({ message: 'no such item', statusCode: 404 }, req404, reply404);
    expect(reply404.statusCode).toBe(404);
    expect(reply404.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'no such item', correlationId: 'cid-404' },
    });
    expect(req404.log.events.some((e) => e.level === 'warn')).toBe(true);
  });

  it('treats Zod validation errors as 400/VALIDATION_ERROR', () => {
    const handler = createApiErrorHandler();
    const reply = makeReply();
    handler({ message: 'bad body', statusCode: 400, validation: [] }, makeRequest(), reply);
    expect(reply.statusCode).toBe(400);
    expect((reply.body as any).error.code).toBe('VALIDATION_ERROR');
  });

  it('sendApiError writes the canonical envelope with default message', () => {
    const reply = makeReply();
    sendApiError(reply, 401, 'UNAUTHORIZED');
    expect(reply.statusCode).toBe(401);
    expect(reply.body).toEqual({
      error: { code: 'UNAUTHORIZED', message: defaultApiErrorMessage('UNAUTHORIZED') },
    });
  });
});
