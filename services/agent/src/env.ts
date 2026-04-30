import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import {
  assertEncryptionKey,
  isUnsafeEnvValue,
  resolveProductionValue,
  resolveSecret,
} from '@pcp/shared';

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
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_OCR_MODEL: z.string().default('gemini-2.0-flash'),
  MINIMAX_TOKEN_PLAN_API_KEY: z.string().optional(),
  MINIMAX_API_KEY: z.string().optional(),
  MINIMAX_BASE_URL: z.string().url().default('https://api.minimax.io/anthropic'),
  MINIMAX_MODEL: z.string().default('MiniMax-M2.7'),
  INTERNAL_SERVICE_TOKEN: z.string().optional(),
  AUTH_BYPASS: z
    .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false'), z.literal('')])
    .optional(),
  WORKSPACE_SERVICE_URL: z.string().url().default('http://localhost:3002'),
  RUNTIME_SERVICE_URL: z.string().url().default('http://localhost:3003'),
  MEMORY_SERVICE_URL: z.string().url().default('http://localhost:3005'),
  BROWSER_SERVICE_URL: z.string().url().default('http://localhost:3007'),
  RUNTIME_DEFAULT_IMAGE: z.string().default('node:20-alpine'),
  WEB_SEARCH_PROVIDER: z.enum(['none', 'brave', 'tavily', 'serpapi']).default('none'),
  WEB_SEARCH_API_KEY: z.string().optional(),
  WEB_FETCH_MAX_BYTES: z.coerce.number().int().positive().default(200_000),
  ENCRYPTION_KEY: z.string().optional(),
  AUTOMATION_TIMEOUT_MS: z.coerce.number().int().positive().default(600_000),
  AUTOMATION_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
});

const parsed = envSchema.parse(rawEnv);
const ctx = { isProduction: parsed.NODE_ENV === 'production' };
const authBypass = parsed.AUTH_BYPASS === '1' || parsed.AUTH_BYPASS === 'true';
if (ctx.isProduction && authBypass) {
  throw new Error('AUTH_BYPASS must not be enabled when NODE_ENV=production');
}

validateSelectedProvider();

export const env = {
  NODE_ENV: parsed.NODE_ENV,
  PORT: parsed.PORT,
  DATABASE_URL: resolveProductionValue(ctx, 'DATABASE_URL', parsed.DATABASE_URL),
  COOKIE_SECRET: resolveSecret(ctx, 'COOKIE_SECRET', parsed.COOKIE_SECRET, 32),
  REDIS_URL: parsed.REDIS_URL,
  LLM_PROVIDER: parsed.LLM_PROVIDER,
  OPENAI_API_KEY: parsed.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: parsed.ANTHROPIC_API_KEY,
  GEMINI_API_KEY: parsed.GEMINI_API_KEY,
  GEMINI_OCR_MODEL: parsed.GEMINI_OCR_MODEL,
  MINIMAX_TOKEN_PLAN_API_KEY: parsed.MINIMAX_TOKEN_PLAN_API_KEY,
  MINIMAX_API_KEY: parsed.MINIMAX_API_KEY,
  MINIMAX_BASE_URL: parsed.MINIMAX_BASE_URL,
  MINIMAX_MODEL: parsed.MINIMAX_MODEL,
  INTERNAL_SERVICE_TOKEN: resolveSecret(
    ctx,
    'INTERNAL_SERVICE_TOKEN',
    parsed.INTERNAL_SERVICE_TOKEN,
    32,
  ),
  AUTH_BYPASS: !ctx.isProduction && authBypass,
  WORKSPACE_SERVICE_URL: parsed.WORKSPACE_SERVICE_URL,
  RUNTIME_SERVICE_URL: parsed.RUNTIME_SERVICE_URL,
  MEMORY_SERVICE_URL: parsed.MEMORY_SERVICE_URL,
  BROWSER_SERVICE_URL: parsed.BROWSER_SERVICE_URL,
  RUNTIME_DEFAULT_IMAGE: parsed.RUNTIME_DEFAULT_IMAGE,
  WEB_SEARCH_PROVIDER: parsed.WEB_SEARCH_PROVIDER,
  WEB_SEARCH_API_KEY: parsed.WEB_SEARCH_API_KEY,
  WEB_FETCH_MAX_BYTES: parsed.WEB_FETCH_MAX_BYTES,
  ENCRYPTION_KEY: resolveAgentEncryptionKey(parsed.ENCRYPTION_KEY),
  AUTOMATION_TIMEOUT_MS: parsed.AUTOMATION_TIMEOUT_MS,
  AUTOMATION_MAX_RETRIES: parsed.AUTOMATION_MAX_RETRIES,
};

/**
 * The agent service decrypts user-provided LLM provider credentials with
 * AES-256-GCM. In production we refuse to start without a strong key — a
 * weak/missing key would silently fail every decrypt, masking config bugs.
 * In development we permit an undefined key (decrypt simply returns null).
 */
function resolveAgentEncryptionKey(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (ctx.isProduction) {
    if (!trimmed || trimmed.length !== 32 || isUnsafeEnvValue(trimmed)) {
      throw new Error('ENCRYPTION_KEY must be a 32-character non-default value in production');
    }
    assertEncryptionKey('ENCRYPTION_KEY', trimmed, ctx);
    return trimmed;
  }
  return trimmed || undefined;
}

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
  if (!ctx.isProduction) return;

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
  if (!value?.trim() || isUnsafeEnvValue(value)) {
    throw new Error(`${name} must be set to a non-default value in production`);
  }
}
