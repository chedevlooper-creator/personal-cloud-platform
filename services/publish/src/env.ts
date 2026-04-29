import { z } from 'zod';
import crypto from 'crypto';
import { isUnsafeEnvValue, resolveProductionValue } from '@pcp/shared';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3006),
  DATABASE_URL: z.string().url().optional(),
  ENCRYPTION_KEY: z.string().optional(),
  PUBLISH_SECCOMP_PROFILE: z.string().optional(),
  PUBLISH_APPARMOR_PROFILE: z.string().optional(),
  PUBLISH_DOCKER_NETWORK: z.string().default('pcp-publish'),
});

const parsed = envSchema.parse(process.env);
const ctx = { isProduction: parsed.NODE_ENV === 'production' };

export const env = {
  NODE_ENV: parsed.NODE_ENV,
  PORT: parsed.PORT,
  DATABASE_URL: resolveProductionValue(ctx, 'DATABASE_URL', parsed.DATABASE_URL),
  ENCRYPTION_KEY: resolveEncryptionKey(parsed.ENCRYPTION_KEY),
  PUBLISH_SECCOMP_PROFILE: parsed.PUBLISH_SECCOMP_PROFILE,
  PUBLISH_APPARMOR_PROFILE: parsed.PUBLISH_APPARMOR_PROFILE,
  PUBLISH_DOCKER_NETWORK: parsed.PUBLISH_DOCKER_NETWORK,
};

function resolveEncryptionKey(value: string | undefined): string {
  const resolved = value?.trim() || '';
  if (resolved && resolved.length === 32) {
    if (ctx.isProduction && isUnsafeEnvValue(resolved)) {
      throw new Error('ENCRYPTION_KEY must be set to a non-default value in production');
    }
    return resolved;
  }
  if (ctx.isProduction) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 characters in production');
  }
  console.warn(
    '[publish] WARNING: ENCRYPTION_KEY is not set to a valid 32-character value. ' +
      'Using an insecure deterministic development fallback key derived from a constant string. ' +
      'This must never be used with production or real data.',
  );
  // Deterministic dev key derived from a constant.
  // Never use this value outside development.
  return crypto.createHash('sha256').update('pcp-publish-dev-key').digest('hex').slice(0, 32);
}
