import { defineConfig } from 'drizzle-kit';
import { z } from 'zod';

import * as dotenv from 'dotenv';
import path from 'path';
import { normalizeDbSearchPath } from './src/connection-options';

// Load Docker defaults first; root .env can override for local development.
dotenv.config({ path: path.resolve(__dirname, '../../infra/docker/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DB_SEARCH_PATH: z.string().optional(),
});

const env = envSchema.parse(process.env);

export default defineConfig({
  schema: './src/schema/*',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  schemaFilter: normalizeDbSearchPath(env.DB_SEARCH_PATH).split(','),
  verbose: true,
  strict: true,
});
