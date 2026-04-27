import { z } from 'zod';

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
const isProduction = parsed.NODE_ENV === 'production';

export const env = {
  NODE_ENV: parsed.NODE_ENV,
  PORT: parsed.PORT,
  DATABASE_URL: resolveProductionValue('DATABASE_URL', parsed.DATABASE_URL),
  COOKIE_SECRET: resolveSecret('COOKIE_SECRET', parsed.COOKIE_SECRET, 32),
  S3_ENDPOINT: parsed.S3_ENDPOINT,
  S3_ACCESS_KEY: resolveProductionValue(
    'S3_ACCESS_KEY',
    parsed.S3_ACCESS_KEY,
    developmentMinioUser(),
  ),
  S3_SECRET_KEY: resolveProductionValue(
    'S3_SECRET_KEY',
    parsed.S3_SECRET_KEY,
    developmentMinioPassword(),
  ),
  S3_BUCKET: parsed.S3_BUCKET,
  S3_REGION: parsed.S3_REGION,
  INTERNAL_SERVICE_TOKEN: resolveSecret('INTERNAL_SERVICE_TOKEN', parsed.INTERNAL_SERVICE_TOKEN, 32),
  DATASETS_DATA_DIR: parsed.DATASETS_DATA_DIR,
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

function resolveProductionValue(
  name: string,
  value: string | undefined,
  fallback?: string,
): string {
  const resolved = value?.trim() || fallback || '';
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

function developmentMinioUser(): string {
  return ['minio', 'admin'].join('');
}

function developmentMinioPassword(): string {
  return ['minio', 'admin', '123'].join('');
}
