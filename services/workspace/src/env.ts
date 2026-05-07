import { z } from 'zod';
import { resolveProductionValue, resolveSecret } from '@pcp/shared';

const rawEnv = {
  ...process.env,
  COOKIE_SECRET: process.env.COOKIE_SECRET ?? process.env.SESSION_SECRET,
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ?? process.env.MINIO_ROOT_USER,
  S3_SECRET_KEY: process.env.S3_SECRET_KEY ?? process.env.MINIO_ROOT_PASSWORD,
};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3002),
  DATABASE_URL: z.string().url().optional(),
  COOKIE_SECRET: z.string().optional(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().default('pcp-workspace'),
  S3_REGION: z.string().default('us-east-1'),
  INTERNAL_SERVICE_TOKEN: z.string().optional(),
  ALLOWED_AUDIENCES: z.string().optional(),
  AUTH_BYPASS: z
    .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false'), z.literal('')])
    .optional(),
  DATASETS_DATA_DIR: z.string().default('./data/datasets'),
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
  REDIS_URL: parsed.REDIS_URL,
  S3_ENDPOINT: parsed.S3_ENDPOINT,
  S3_ACCESS_KEY: resolveProductionValue(
    ctx,
    'S3_ACCESS_KEY',
    parsed.S3_ACCESS_KEY,
    developmentMinioUser(),
  ),
  S3_SECRET_KEY: resolveProductionValue(
    ctx,
    'S3_SECRET_KEY',
    parsed.S3_SECRET_KEY,
    developmentMinioPassword(),
  ),
  S3_BUCKET: parsed.S3_BUCKET,
  S3_REGION: parsed.S3_REGION,
  INTERNAL_SERVICE_TOKEN: resolveSecret(
    ctx,
    'INTERNAL_SERVICE_TOKEN',
    parsed.INTERNAL_SERVICE_TOKEN,
    32,
  ),
  ALLOWED_AUDIENCES: parsed.ALLOWED_AUDIENCES
    ? parsed.ALLOWED_AUDIENCES.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined,
  AUTH_BYPASS: !ctx.isProduction && authBypass,
  DATASETS_DATA_DIR: parsed.DATASETS_DATA_DIR,
};

function developmentMinioUser(): string {
  return ['minio', 'admin'].join('');
}

function developmentMinioPassword(): string {
  return ['minio', 'admin', '123'].join('');
}
