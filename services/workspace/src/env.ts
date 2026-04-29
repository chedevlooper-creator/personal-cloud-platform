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
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().default('pcp-workspace'),
  S3_REGION: z.string().default('us-east-1'),
  INTERNAL_SERVICE_TOKEN: z.string().optional(),
  DATASETS_DATA_DIR: z.string().default('./data/datasets'),
});

const parsed = envSchema.parse(rawEnv);
const ctx = { isProduction: parsed.NODE_ENV === 'production' };

export const env = {
  NODE_ENV: parsed.NODE_ENV,
  PORT: parsed.PORT,
  DATABASE_URL: resolveProductionValue(ctx, 'DATABASE_URL', parsed.DATABASE_URL),
  COOKIE_SECRET: resolveSecret(ctx, 'COOKIE_SECRET', parsed.COOKIE_SECRET, 32),
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
  DATASETS_DATA_DIR: parsed.DATASETS_DATA_DIR,
};

function developmentMinioUser(): string {
  return ['minio', 'admin'].join('');
}

function developmentMinioPassword(): string {
  return ['minio', 'admin', '123'].join('');
}
