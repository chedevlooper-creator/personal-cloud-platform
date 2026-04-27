import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ALL_PACKAGE_FILTERS = [
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
];

const LINT_FILTERS = ['--filter', 'web', '--filter', '@pcp/db'];
const TEST_FILTERS = [
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
];

export function makeBaselineSmokeCommands(packageManager = 'corepack pnpm@9.0.0') {
  const [command, ...baseArgs] = packageManager.split(/\s+/).filter(Boolean);
  if (!command) {
    throw new Error('Package manager command is empty');
  }

  return [
    [command, [...baseArgs, '--version']],
    [command, [...baseArgs, ...ALL_PACKAGE_FILTERS, 'typecheck']],
    [command, [...baseArgs, ...LINT_FILTERS, 'lint']],
    [command, [...baseArgs, ...TEST_FILTERS, 'test']],
  ];
}

export function runBaselineSmoke() {
  const commands = makeBaselineSmokeCommands(process.env.PCP_PACKAGE_MANAGER);

  for (const [command, args] of commands) {
    const printable = [command, ...args].join(' ');
    console.log(`\n$ ${printable}`);

    const spawnCommand = resolveSpawnCommand(command, args);
    const result = spawnSync(spawnCommand.command, spawnCommand.args, {
      stdio: 'inherit',
      shell: false,
    });

    if (result.error) {
      console.error(`\nBaseline smoke failed to start command: ${printable}`);
      console.error(result.error.message);
      process.exit(1);
    }

    if (result.status !== 0) {
      console.error(`\nBaseline smoke failed: ${printable}`);
      process.exit(result.status ?? 1);
    }
  }

  console.log('\nBaseline smoke passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBaselineSmoke();
}

function resolveSpawnCommand(command, args) {
  if (process.platform === 'win32' && command.toLowerCase() === 'corepack') {
    const corepackScript = join(
      dirname(process.execPath),
      'node_modules',
      'corepack',
      'dist',
      'corepack.js',
    );

    if (existsSync(corepackScript)) {
      return {
        command: process.execPath,
        args: [corepackScript, ...args],
      };
    }
  }

  return { command, args };
}
