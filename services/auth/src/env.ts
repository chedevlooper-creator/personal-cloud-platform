import { z } from 'zod';

const rawEnv = {
  ...process.env,
  COOKIE_SECRET: process.env.COOKIE_SECRET ?? process.env.SESSION_SECRET,
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL ?? process.env.GOOGLE_REDIRECT_URI,
  FRONTEND_URL: process.env.FRONTEND_URL ?? process.env.APP_URL,
};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  COOKIE_SECRET: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().default('http://localhost:3001/auth/oauth/google/callback'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  ADMIN_EMAIL: z.string().email().optional(),
});

const parsed = envSchema.parse(rawEnv);
const isProduction = parsed.NODE_ENV === 'production';

export const env = {
  NODE_ENV: parsed.NODE_ENV,
  PORT: parsed.PORT,
  COOKIE_SECRET: resolveSecret('COOKIE_SECRET', parsed.COOKIE_SECRET, 32),
  ENCRYPTION_KEY: resolveEncryptionKey(parsed.ENCRYPTION_KEY),
  GOOGLE_CLIENT_ID: resolveExternalValue('GOOGLE_CLIENT_ID', parsed.GOOGLE_CLIENT_ID),
  GOOGLE_CLIENT_SECRET: resolveExternalValue('GOOGLE_CLIENT_SECRET', parsed.GOOGLE_CLIENT_SECRET),
  GOOGLE_CALLBACK_URL: parsed.GOOGLE_CALLBACK_URL,
  FRONTEND_URL: parsed.FRONTEND_URL,
  ADMIN_EMAIL: parsed.ADMIN_EMAIL?.trim().toLowerCase(),
};

function resolveSecret(name: string, value: string | undefined, minLength: number): string {
  const resolved = value?.trim() || makeDevelopmentSecret(minLength, name);
  if (resolved.length < minLength) {
    throw new Error(`${name} must be at least ${minLength} characters long`);
  }
  if (isProduction && isUnsafeSecret(resolved)) {
    throw new Error(`${name} must be set to a non-default value in production`);
  }
  return resolved;
}

function resolveEncryptionKey(value: string | undefined): string {
  const resolved = value?.trim() || makeDevelopmentSecret(32, 'ENCRYPTION_KEY');
  if (Buffer.byteLength(resolved, 'utf8') !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 bytes long');
  }
  if (isProduction && isUnsafeSecret(resolved)) {
    throw new Error('ENCRYPTION_KEY must be set to a non-default value in production');
  }
  return resolved;
}

function resolveExternalValue(name: string, value: string | undefined): string {
  const resolved = value?.trim() || makeDevelopmentValue(name);
  if (isProduction && isUnsafeSecret(resolved)) {
    throw new Error(`${name} must be set to a non-default value in production`);
  }
  return resolved;
}

function isUnsafeSecret(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    lower.includes('change_me') ||
    lower.includes('replace') ||
    lower.includes('dummy') ||
    lower.startsWith('dev-') ||
    value === '0123456789abcdef'.repeat(2)
  );
}

function makeDevelopmentSecret(length: number, name: string): string {
  const seed = `dev-${name.toLowerCase().replace(/_/g, '-')}-`;
  return seed.repeat(Math.ceil(length / seed.length)).slice(0, length);
}

function makeDevelopmentValue(name: string): string {
  return `dev-${name.toLowerCase().replace(/_/g, '-')}`;
}
