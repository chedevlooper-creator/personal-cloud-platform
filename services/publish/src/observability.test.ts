import { describe, expect, it } from 'vitest';
import {
  createCorrelationIdGenerator,
  registerObservability,
  withCorrelationHeaders,
} from '@pcp/shared';

describe('createCorrelationIdGenerator', () => {
  it('reuses safe incoming x-correlation-id header', () => {
    const gen = createCorrelationIdGenerator();
    const id = gen({ headers: { 'x-correlation-id': 'abc-123' } });
    expect(id).toBe('abc-123');
  });

  it('generates a fresh id when no header is present', () => {
    const gen = createCorrelationIdGenerator();
    const a = gen({ headers: {} });
    const b = gen({ headers: {} });
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^req-/);
  });

  it('strips disallowed characters from incoming header', () => {
    const gen = createCorrelationIdGenerator();
    const id = gen({ headers: { 'x-correlation-id': 'foo bar/baz?' } });
    expect(id).toBe('foobarbaz');
  });

  it('falls back to generated id when header exceeds length cap', () => {
    const gen = createCorrelationIdGenerator();
    const long = 'x'.repeat(129);
    const id = gen({ headers: { 'x-correlation-id': long } });
    expect(id).not.toBe(long);
    expect(id).toMatch(/^req-/);
  });

  it('handles array-valued headers by taking the first entry', () => {
    const gen = createCorrelationIdGenerator();
    const id = gen({ headers: { 'x-correlation-id': ['first', 'second'] } });
    expect(id).toBe('first');
  });
});

describe('withCorrelationHeaders', () => {
  it('adds the header when correlation id is provided', () => {
    const out = withCorrelationHeaders({ accept: 'application/json' }, 'corr-1');
    expect(out['x-correlation-id']).toBe('corr-1');
    expect(out['accept']).toBe('application/json');
  });

  it('does not overwrite an existing header', () => {
    const out = withCorrelationHeaders({ 'x-correlation-id': 'kept' }, 'ignored');
    expect(out['x-correlation-id']).toBe('kept');
  });

  it('returns a fresh object even when no id is provided', () => {
    const headers = { foo: 'bar' };
    const out = withCorrelationHeaders(headers, undefined);
    expect(out).toEqual({ foo: 'bar' });
    expect(out).not.toBe(headers);
  });
});

describe('registerObservability', () => {
  type Hook = (req: unknown, reply: unknown, done: () => void) => void;

  function buildMockApp() {
    const hooks: Record<string, Hook> = {};
    const app = {
      addHook: (name: 'onRequest' | 'onResponse', handler: Hook) => {
        hooks[name] = handler;
      },
      get: () => undefined,
    };
    return { app, hooks };
  }

  function fire(hooks: Record<string, Hook>, req: unknown, reply: unknown) {
    return new Promise<void>((resolve) => {
      hooks.onRequest!(req, reply, () => {
        hooks.onResponse!(req, reply, () => resolve());
      });
    });
  }

  it('uses matched route template, not raw url, to bound metric cardinality', async () => {
    const { app, hooks } = buildMockApp();
    const handles = registerObservability(app, {
      serviceName: 'test',
      disableDefaultMetrics: true,
    });
    await fire(
      hooks,
      { method: 'GET', url: '/users/abc-123?foo=bar', routeOptions: { url: '/users/:id' } },
      { statusCode: 200, elapsedTime: 5 },
    );
    const text = await handles.registry.metrics();
    expect(text).toContain('route="/users/:id"');
    expect(text).not.toContain('abc-123');
  });

  it('collapses unmatched routes to "unmatched" sentinel', async () => {
    const { app, hooks } = buildMockApp();
    const handles = registerObservability(app, {
      serviceName: 'test',
      disableDefaultMetrics: true,
    });
    await fire(
      hooks,
      { method: 'GET', url: '/some/random/path' },
      { statusCode: 404, elapsedTime: 2 },
    );
    const text = await handles.registry.metrics();
    expect(text).toContain('route="unmatched"');
    expect(text).not.toContain('/some/random/path');
  });

  it('tracks in-flight requests and decrements after response', async () => {
    const { app, hooks } = buildMockApp();
    const handles = registerObservability(app, {
      serviceName: 'test',
      disableDefaultMetrics: true,
    });
    let mid = 0;
    await new Promise<void>((resolve) => {
      hooks.onRequest!({ method: 'POST' }, {}, async () => {
        mid = (await handles.httpRequestsInFlight.get()).values[0]?.value ?? 0;
        hooks.onResponse!(
          { method: 'POST', routeOptions: { url: '/x' } },
          { statusCode: 200, elapsedTime: 1 },
          () => resolve(),
        );
      });
    });
    expect(mid).toBe(1);
    const after = (await handles.httpRequestsInFlight.get()).values[0]?.value ?? 0;
    expect(after).toBe(0);
  });
});
