import { defineConfig } from 'drizzle-kit';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
});

const env = envSchema.parse(process.env);

export default defineConfig({
  schema: './src/schema/*',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});