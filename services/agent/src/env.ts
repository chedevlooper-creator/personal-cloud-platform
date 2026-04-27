import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';

loadLocalEnv();

const rawEnv = {
  ...process.env,
  COOKIE_SECRET: process.env.COOKIE_SECRET ?? process.env.SESSION_SECRET,
};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3004),
  DATABASE_URL: z.string().url().optional(),
  COOKIE_SECRET: z.string().optional(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  LLM_PROVIDER: z.enum(['openai', 'anthropic', 'minimax']).default('openai'),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  MINIMAX_TOKEN_PLAN_API_KEY: z.string().optional(),
  MINIMAX_API_KEY: z.string().optional(),
  MINIMAX_BASE_URL: z.string().url().default('https://api.minimax.io/anthropic'),
  MINIMAX_MODEL: z.string().default('MiniMax-M2.7'),
  INTERNAL_SERVICE_TOKEN: z.string().optional(),
  WORKSPACE_SERVICE_URL: z.string().url().default('http://localhost:3002'),
  RUNTIME_SERVICE_URL: z.string().url().default('http://localhost:3003'),
  MEMORY_SERVICE_URL: z.string().url().default('http://localhost:3005'),
  BROWSER_SERVICE_URL: z.string().url().default('http://localhost:3007'),
  RUNTIME_DEFAULT_IMAGE: z.string().default('node:20-bookworm-slim'),
  WEB_SEARCH_PROVIDER: z.enum(['none', 'brave', 'tavily', 'serpapi']).default('none'),
  WEB_SEARCH_API_KEY: z.string().optional(),
  WEB_FETCH_MAX_BYTES: z.coerce.number().int().positive().default(200_000),
});

const parsed = envSchema.parse(rawEnv);
const isProduction = parsed.NODE_ENV === 'production';

validateSelectedProvider();

export const env = {
  NODE_ENV: parsed.NODE_ENV,
  PORT: parsed.PORT,
  DATABASE_URL: resolveProductionValue('DATABASE_URL', parsed.DATABASE_URL),
  COOKIE_SECRET: resolveSecret('COOKIE_SECRET', parsed.COOKIE_SECRET, 32),
  REDIS_URL: parsed.REDIS_URL,
  LLM_PROVIDER: parsed.LLM_PROVIDER,
  OPENAI_API_KEY: parsed.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: parsed.ANTHROPIC_API_KEY,
  MINIMAX_TOKEN_PLAN_API_KEY: parsed.MINIMAX_TOKEN_PLAN_API_KEY,
  MINIMAX_API_KEY: parsed.MINIMAX_API_KEY,
  MINIMAX_BASE_URL: parsed.MINIMAX_BASE_URL,
  MINIMAX_MODEL: parsed.MINIMAX_MODEL,
  INTERNAL_SERVICE_TOKEN: resolveSecret('INTERNAL_SERVICE_TOKEN', parsed.INTERNAL_SERVICE_TOKEN, 32),
  WORKSPACE_SERVICE_URL: parsed.WORKSPACE_SERVICE_URL,
  RUNTIME_SERVICE_URL: parsed.RUNTIME_SERVICE_URL,
  MEMORY_SERVICE_URL: parsed.MEMORY_SERVICE_URL,
  BROWSER_SERVICE_URL: parsed.BROWSER_SERVICE_URL,
  RUNTIME_DEFAULT_IMAGE: parsed.RUNTIME_DEFAULT_IMAGE,
  WEB_SEARCH_PROVIDER: parsed.WEB_SEARCH_PROVIDER,
  WEB_SEARCH_API_KEY: parsed.WEB_SEARCH_API_KEY,
  WEB_FETCH_MAX_BYTES: parsed.WEB_FETCH_MAX_BYTES,
};

function loadLocalEnv(): void {
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

function validateSelectedProvider(): void {
  if (!isProduction) return;

  if (parsed.LLM_PROVIDER === 'openai') {
    requireProductionProviderKey('OPENAI_API_KEY', parsed.OPENAI_API_KEY);
  } else if (parsed.LLM_PROVIDER === 'anthropic') {
    requireProductionProviderKey('ANTHROPIC_API_KEY', parsed.ANTHROPIC_API_KEY);
  } else {
    requireProductionProviderKey(
      'MINIMAX_TOKEN_PLAN_API_KEY or MINIMAX_API_KEY',
      parsed.MINIMAX_TOKEN_PLAN_API_KEY ?? parsed.MINIMAX_API_KEY,
    );
  }
}

function requireProductionProviderKey(name: string, value: string | undefined): void {
  if (!value?.trim() || isUnsafeValue(value)) {
    throw new Error(`${name} must be set to a non-default value in production`);
  }
}

function resolveSecret(name: string, value: string | undefined, minLength: number): string {
  const resolved = value?.trim() || makeDevelopmentSecret(minLength, name);
  if (resolved.length < minLength) {
    throw new Error(`${name} must be at least ${minLength} characters long`);
  }
  if (isProduction && isUnsafeValue(resolved)) {
    throw new Error(`${name} must be set to a non-default value in production`);
  }
  return resolved;
}

function resolveProductionValue(name: string, value: string | undefined): string {
  const resolved = value?.trim() || '';
  if (isProduction && (!resolved || isUnsafeValue(resolved))) {
    throw new Error(`${name} must be set to a non-default value in production`);
  }
  return resolved;
}

function isUnsafeValue(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    lower.includes('change_me') ||
    lower.includes('replace') ||
    lower.includes('dummy') ||
    lower.startsWith('dev-')
  );
}

function makeDevelopmentSecret(length: number, name: string): string {
  const seed = `dev-${name.toLowerCase().replace(/_/g, '-')}-`;
  return seed.repeat(Math.ceil(length / seed.length)).slice(0, length);
}
