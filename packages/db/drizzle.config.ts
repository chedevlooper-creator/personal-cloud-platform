import { defineConfig } from 'drizzle-kit';
import { z } from 'zod';

import * as dotenv from 'dotenv';
import path from 'path';

// Load Docker defaults first; root .env can override for local development.
dotenv.config({ path: path.resolve(__dirname, '../../infra/docker/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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
