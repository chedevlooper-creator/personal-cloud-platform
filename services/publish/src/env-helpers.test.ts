import { describe, it, expect } from 'vitest';
import {
  isUnsafeEnvValue,
  makeDevelopmentSecret,
  resolveExternalValue,
  resolveProductionValue,
  resolveSecret,
} from '@pcp/shared';

const dev = { isProduction: false };
const prod = { isProduction: true };

describe('env-helpers', () => {
  it('flags unsafe placeholder values', () => {
    expect(isUnsafeEnvValue('change_me_secret')).toBe(true);
    expect(isUnsafeEnvValue('please-replace')).toBe(true);
    expect(isUnsafeEnvValue('dummy')).toBe(true);
    expect(isUnsafeEnvValue('dev-cookie-secret-foo')).toBe(true);
    expect(isUnsafeEnvValue('0123456789abcdef'.repeat(2))).toBe(true);
    expect(isUnsafeEnvValue('a-real-32-byte-secret-value-xyzqr!')).toBe(false);
  });

  it('resolveSecret falls back in development and refuses dev fallbacks in production', () => {
    const value = resolveSecret(dev, 'COOKIE_SECRET', undefined, 32);
    expect(value.length).toBe(32);
    expect(value.startsWith('dev-')).toBe(true);

    expect(() => resolveSecret(prod, 'COOKIE_SECRET', undefined, 32)).toThrow(
      /non-default value in production/,
    );
    expect(() => resolveSecret(dev, 'COOKIE_SECRET', 'short', 32)).toThrow(
      /at least 32 characters/,
    );
    expect(resolveSecret(prod, 'COOKIE_SECRET', 'a'.repeat(40), 32)).toBe('a'.repeat(40));
  });

  it('resolveProductionValue requires real values in production but allows empty in dev', () => {
    expect(resolveProductionValue(dev, 'DATABASE_URL', undefined)).toBe('');
    expect(resolveProductionValue(dev, 'X', undefined, 'fallback')).toBe('fallback');
    expect(() => resolveProductionValue(prod, 'DATABASE_URL', undefined)).toThrow(
      /non-default value in production/,
    );
    expect(() => resolveProductionValue(prod, 'DATABASE_URL', 'change_me')).toThrow(
      /non-default value in production/,
    );
    expect(resolveProductionValue(prod, 'DATABASE_URL', 'postgres://prod/db')).toBe(
      'postgres://prod/db',
    );
  });

  it('resolveExternalValue makes deterministic dev placeholders', () => {
    expect(resolveExternalValue(dev, 'GOOGLE_CLIENT_ID', undefined)).toBe('dev-google-client-id');
    expect(() => resolveExternalValue(prod, 'GOOGLE_CLIENT_ID', undefined)).toThrow(
      /non-default value in production/,
    );
  });

  it('makeDevelopmentSecret produces fixed-length deterministic strings', () => {
    const secret = makeDevelopmentSecret(32, 'COOKIE_SECRET');
    expect(secret.length).toBe(32);
    expect(makeDevelopmentSecret(32, 'COOKIE_SECRET')).toBe(secret);
  });
});
