import { spawnSync } from 'node:child_process';

const commands = [
  ['pnpm', ['--version']],
  ['pnpm', ['-r', '--if-present', 'typecheck']],
  ['pnpm', ['-r', '--if-present', 'lint']],
  ['pnpm', ['-r', '--if-present', 'test']],
];

for (const [command, args] of commands) {
  const printable = [command, ...args].join(' ');
  console.log(`\n$ ${printable}`);

  const result = spawnSync(command, args, {
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
