import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

loadLocalEnv();

function loadLocalEnv() {
  const root = findWorkspaceRoot(process.cwd());
  const serviceRoot = dirname(__dirname);

  const candidates = [
    join(serviceRoot, '.env.local'),
    join(root, '.env.local'),
    join(serviceRoot, '.env'),
    join(root, '.env'),
    join(root, 'infra/docker/.env'),
  ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    applyEnvFile(filePath);
  }
}

function findWorkspaceRoot(start: string) {
  let current = start;

  while (dirname(current) !== current) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }

    current = dirname(current);
  }

  return start;
}

function applyEnvFile(filePath: string) {
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (process.env[key] !== undefined) continue;

    process.env[key] = unquote(rawValue);
  }
}

function unquote(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
