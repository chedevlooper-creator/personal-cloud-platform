import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { makeBaselineSmokeCommands } from './baseline-smoke.mjs';

describe('baseline smoke commands', () => {
  it('uses the current package manager command without recursively running root scripts', () => {
    const commands = makeBaselineSmokeCommands('corepack pnpm@9.0.0');

    assert.deepEqual(commands[0], ['corepack', ['pnpm@9.0.0', '--version']]);
    assert.deepEqual(commands[1], [
      'corepack',
      [
        'pnpm@9.0.0',
        '--filter',
        'web',
        '--filter',
        '@pcp/db',
        '--filter',
        '@pcp/shared',
        '--filter',
        '@pcp/auth-service',
        '--filter',
        '@pcp/workspace-service',
        '--filter',
        '@pcp/runtime-service',
        '--filter',
        '@pcp/agent-service',
        '--filter',
        '@pcp/memory-service',
        '--filter',
        '@pcp/publish-service',
        '--filter',
        '@pcp/browser-service',
        'typecheck',
      ],
    ]);
    assert.deepEqual(commands[3], [
      'corepack',
      [
        'pnpm@9.0.0',
        '--filter',
        '@pcp/auth-service',
        '--filter',
        '@pcp/workspace-service',
        '--filter',
        '@pcp/runtime-service',
        '--filter',
        '@pcp/agent-service',
        '--filter',
        '@pcp/memory-service',
        '--filter',
        '@pcp/publish-service',
        '--filter',
        '@pcp/browser-service',
        'test',
      ],
    ]);
  });
});
