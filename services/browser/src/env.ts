import { z } from 'zod';
import { resolveProductionValue, resolveSecret } from '@pcp/shared';

const rawEnv = {
  ...process.env,
  COOKIE_SECRET: process.env.COOKIE_SECRET ?? process.env.SESSION_SECRET,
};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3007),
  DATABASE_URL: z.string().url().optional(),
  COOKIE_SECRET: z.string().optional(),
  INTERNAL_SERVICE_TOKEN: z.string().optional(),
  AUTH_BYPASS: z
    .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false'), z.literal('')])
    .optional(),
  BROWSER_PROFILE_DIR: z.string().default('./data/browser-profiles'),
  BROWSER_SESSION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  BROWSER_MAX_SESSIONS_PER_USER: z.coerce.number().int().positive().default(3),
});

const parsed = envSchema.parse(rawEnv);
const ctx = { isProduction: parsed.NODE_ENV === 'production' };
const authBypass = parsed.AUTH_BYPASS === '1' || parsed.AUTH_BYPASS === 'true';
if (ctx.isProduction && authBypass) {
  throw new Error('AUTH_BYPASS must not be enabled when NODE_ENV=production');
}

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
  AUTH_BYPASS: !ctx.isProduction && authBypass,
  BROWSER_PROFILE_DIR: parsed.BROWSER_PROFILE_DIR,
  BROWSER_SESSION_TIMEOUT_MS: parsed.BROWSER_SESSION_TIMEOUT_MS,
  BROWSER_MAX_SESSIONS_PER_USER: parsed.BROWSER_MAX_SESSIONS_PER_USER,
};
