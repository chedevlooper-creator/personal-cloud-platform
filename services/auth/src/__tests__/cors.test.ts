import { describe, expect, it } from 'vitest';
import { createCorsOptions, parseAllowedCorsOrigins } from '@pcp/shared';

describe('shared CORS options', () => {
  it('keeps permissive development behavior', () => {
    expect(createCorsOptions('development')).toEqual({ origin: true, credentials: true });
    expect(createCorsOptions('test')).toEqual({ origin: true, credentials: true });
  });

  it('uses validated production origins from env', () => {
    expect(createCorsOptions('production', 'https://app.example.com, https://admin.example.com/')).toEqual({
      origin: ['https://app.example.com', 'https://admin.example.com'],
      credentials: true,
    });
  });

  it('deduplicates production origins', () => {
    expect(
      parseAllowedCorsOrigins('https://app.example.com,https://app.example.com/'),
    ).toEqual(['https://app.example.com']);
  });

  it('rejects missing, wildcard, and path-based production origins', () => {
    expect(() => parseAllowedCorsOrigins(undefined)).toThrow('CORS_ALLOWED_ORIGINS must be set');
    expect(() => parseAllowedCorsOrigins('*')).toThrow('must not contain wildcard');
    expect(() => parseAllowedCorsOrigins('https://app.example.com/dashboard')).toThrow(
      'entries must be origins only',
    );
  });
});
