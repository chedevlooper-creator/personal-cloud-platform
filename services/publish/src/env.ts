import { z } from 'zod';
import crypto from 'crypto';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3006),
  DATABASE_URL: z.string().url().optional(),
  ENCRYPTION_KEY: z.string().optional(),
});

const parsed = envSchema.parse(process.env);
const isProduction = parsed.NODE_ENV === 'production';

export const env = {
  NODE_ENV: parsed.NODE_ENV,
  PORT: parsed.PORT,
  DATABASE_URL: resolveProductionValue('DATABASE_URL', parsed.DATABASE_URL),
  ENCRYPTION_KEY: resolveEncryptionKey(parsed.ENCRYPTION_KEY),
};

function resolveProductionValue(name: string, value: string | undefined): string {
  const resolved = value?.trim() || '';
  if (isProduction && (!resolved || isUnsafeValue(resolved))) {
    throw new Error(`${name} must be set to a non-default value in production`);
  }
  return resolved;
}

function resolveEncryptionKey(value: string | undefined): string {
  const resolved = value?.trim() || '';
  if (resolved && resolved.length === 32) return resolved;
  if (isProduction) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 bytes in production');
  }
  // Deterministic dev key derived from a constant. Logged loudly elsewhere.
  // Never use this value outside development.
  return crypto.createHash('sha256').update('pcp-publish-dev-key').digest('hex').slice(0, 32);
}

function isUnsafeValue(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.includes('change_me') || lower.includes('replace') || lower.startsWith('dev-');
}
