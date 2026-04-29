import { z } from 'zod';
import {
  assertEncryptionKey,
  isUnsafeEnvValue,
  makeDevelopmentSecret,
  resolveExternalValue,
  resolveSecret,
} from '@pcp/shared';

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
const ctx = { isProduction: parsed.NODE_ENV === 'production' };

export const env = {
  NODE_ENV: parsed.NODE_ENV,
  PORT: parsed.PORT,
  COOKIE_SECRET: resolveSecret(ctx, 'COOKIE_SECRET', parsed.COOKIE_SECRET, 32),
  ENCRYPTION_KEY: resolveEncryptionKey(parsed.ENCRYPTION_KEY),
  GOOGLE_CLIENT_ID: resolveExternalValue(ctx, 'GOOGLE_CLIENT_ID', parsed.GOOGLE_CLIENT_ID),
  GOOGLE_CLIENT_SECRET: resolveExternalValue(ctx, 'GOOGLE_CLIENT_SECRET', parsed.GOOGLE_CLIENT_SECRET),
  GOOGLE_CALLBACK_URL: parsed.GOOGLE_CALLBACK_URL,
  FRONTEND_URL: parsed.FRONTEND_URL,
  ADMIN_EMAIL: parsed.ADMIN_EMAIL?.trim().toLowerCase(),
};

function resolveEncryptionKey(value: string | undefined): string {
  const resolved = value?.trim() || makeDevelopmentSecret(32, 'ENCRYPTION_KEY');
  if (ctx.isProduction && (!value?.trim() || isUnsafeEnvValue(resolved))) {
    throw new Error('ENCRYPTION_KEY must be set to a non-default value in production');
  }
  assertEncryptionKey('ENCRYPTION_KEY', resolved, ctx);
  return resolved;
}
