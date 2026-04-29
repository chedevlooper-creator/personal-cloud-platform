import { describe, expect, it } from 'vitest';
import {
  createCorrelationIdGenerator,
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
