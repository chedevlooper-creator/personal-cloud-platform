import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_DB_SEARCH_PATH,
  createPostgresOptions,
  normalizeDbSearchPath,
} from './connection-options';

describe('connection options', () => {
  it('defaults DB connections to cloudmind before public', () => {
    assert.equal(DEFAULT_DB_SEARCH_PATH, 'cloudmind,public');
    assert.equal(normalizeDbSearchPath(undefined), 'cloudmind,public');
    assert.deepEqual(createPostgresOptions({ maxConnections: 10 }), {
      max: 10,
      connection: { search_path: 'cloudmind,public' },
    });
  });

  it('normalizes explicit DB_SEARCH_PATH values', () => {
    assert.equal(normalizeDbSearchPath(' cloudmind, public ,, '), 'cloudmind,public');
    assert.deepEqual(
      createPostgresOptions({ maxConnections: 12, searchPath: 'cloudmind,public' }),
      {
        max: 12,
        connection: { search_path: 'cloudmind,public' },
      },
    );
    assert.deepEqual(createPostgresOptions({ maxConnections: 4, searchPath: ' public ' }), {
      max: 4,
      connection: { search_path: 'public' },
    });
  });
});
