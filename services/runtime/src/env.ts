import { z } from 'zod';
import { resolveProductionValue, resolveSecret } from '@pcp/shared';

const rawEnv = {
  ...process.env,
  COOKIE_SECRET: process.env.COOKIE_SECRET ?? process.env.SESSION_SECRET,
};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3003),
  DATABASE_URL: z.string().url().optional(),
  COOKIE_SECRET: z.string().optional(),
  INTERNAL_SERVICE_TOKEN: z.string().optional(),
  WORKSPACE_HOST_ROOT: z.string().default('/var/lib/pcp/workspaces'),
  WORKSPACE_SERVICE_URL: z.string().url().default('http://localhost:3002'),
  RUNTIME_SECCOMP_PROFILE: z.string().optional(),
  RUNTIME_APPARMOR_PROFILE: z.string().optional(),
});

const parsed = envSchema.parse(rawEnv);
const ctx = { isProduction: parsed.NODE_ENV === 'production' };

export const env = {
  NODE_ENV: parsed.NODE_ENV,
  PORT: parsed.PORT,
  DATABASE_URL: resolveProductionValue(ctx, 'DATABASE_URL', parsed.DATABASE_URL),
  COOKIE_SECRET: resolveSecret(ctx, 'COOKIE_SECRET', parsed.COOKIE_SECRET, 32),
  INTERNAL_SERVICE_TOKEN: resolveSecret(
    ctx,
    'INTERNAL_SERVICE_TOKEN',
    parsed.INTERNAL_SERVICE_TOKEN,
    32,
  ),
  WORKSPACE_HOST_ROOT: parsed.WORKSPACE_HOST_ROOT,
  WORKSPACE_SERVICE_URL: parsed.WORKSPACE_SERVICE_URL,
  RUNTIME_SECCOMP_PROFILE: parsed.RUNTIME_SECCOMP_PROFILE,
  RUNTIME_APPARMOR_PROFILE: parsed.RUNTIME_APPARMOR_PROFILE,
};
