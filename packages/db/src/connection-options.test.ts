import { describe, it, expect } from 'vitest';

import {
  DEFAULT_DB_SEARCH_PATH,
  createPostgresOptions,
  normalizeDbSearchPath,
} from './connection-options';

describe('connection options', () => {
  it('defaults DB connections to cloudmind before public', () => {
    expect(DEFAULT_DB_SEARCH_PATH).toBe('cloudmind,public');
    expect(normalizeDbSearchPath(undefined)).toBe('cloudmind,public');
    expect(createPostgresOptions({ maxConnections: 10 })).toEqual({
      max: 10,
      connection: { search_path: 'cloudmind,public' },
    });
  });

  it('normalizes explicit DB_SEARCH_PATH values', () => {
    expect(normalizeDbSearchPath(' cloudmind, public ,, ')).toBe('cloudmind,public');
    expect(
      createPostgresOptions({ maxConnections: 12, searchPath: 'cloudmind,public' }),
    ).toEqual({
      max: 12,
      connection: { search_path: 'cloudmind,public' },
    });
    expect(createPostgresOptions({ maxConnections: 4, searchPath: ' public ' })).toEqual({
      max: 4,
      connection: { search_path: 'public' },
    });
  });
});
