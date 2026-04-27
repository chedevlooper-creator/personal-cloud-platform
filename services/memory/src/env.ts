import { z } from 'zod';

const rawEnv = {
  ...process.env,
  COOKIE_SECRET: process.env.COOKIE_SECRET ?? process.env.SESSION_SECRET,
};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3005),
  DATABASE_URL: z.string().url().optional(),
  COOKIE_SECRET: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
});

const parsed = envSchema.parse(rawEnv);
const isProduction = parsed.NODE_ENV === 'production';

export const env = {
  NODE_ENV: parsed.NODE_ENV,
  PORT: parsed.PORT,
  DATABASE_URL: resolveProductionValue('DATABASE_URL', parsed.DATABASE_URL),
  COOKIE_SECRET: resolveSecret('COOKIE_SECRET', parsed.COOKIE_SECRET, 32),
  OPENAI_API_KEY: resolveProviderKey('OPENAI_API_KEY', parsed.OPENAI_API_KEY),
};

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

function resolveProviderKey(name: string, value: string | undefined): string {
  const resolved = value?.trim() || makeDevelopmentValue(name);
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
  return lower.includes('change_me') || lower.includes('replace') || lower.startsWith('dev-');
}

function makeDevelopmentSecret(length: number, name: string): string {
  const seed = `dev-${name.toLowerCase().replace(/_/g, '-')}-`;
  return seed.repeat(Math.ceil(length / seed.length)).slice(0, length);
}

function makeDevelopmentValue(name: string): string {
  return `dev-${name.toLowerCase().replace(/_/g, '-')}`;
}
