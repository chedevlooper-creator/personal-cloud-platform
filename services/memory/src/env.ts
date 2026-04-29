import { z } from 'zod';
import { resolveExternalValue, resolveProductionValue, resolveSecret } from '@pcp/shared';

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
  INTERNAL_SERVICE_TOKEN: z.string().optional(),
});

const parsed = envSchema.parse(rawEnv);
const ctx = { isProduction: parsed.NODE_ENV === 'production' };

export const env = {
  NODE_ENV: parsed.NODE_ENV,
  PORT: parsed.PORT,
  DATABASE_URL: resolveProductionValue(ctx, 'DATABASE_URL', parsed.DATABASE_URL),
  COOKIE_SECRET: resolveSecret(ctx, 'COOKIE_SECRET', parsed.COOKIE_SECRET, 32),
  OPENAI_API_KEY: resolveExternalValue(ctx, 'OPENAI_API_KEY', parsed.OPENAI_API_KEY),
  INTERNAL_SERVICE_TOKEN: resolveSecret(
    ctx,
    'INTERNAL_SERVICE_TOKEN',
    parsed.INTERNAL_SERVICE_TOKEN,
    32,
  ),
};
