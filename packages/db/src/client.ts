import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { z } from 'zod';
import * as dotenv from 'dotenv';
import path from 'path';
import { createPostgresOptions } from './connection-options';

// Load Docker defaults first; root .env can override for local development.
dotenv.config({ path: path.resolve(__dirname, '../../../infra/docker/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import * as schema from './schema';

// Environment variable validation with Zod
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DB_MAX_CONNECTIONS: z.coerce.number().default(10),
  DB_SEARCH_PATH: z.string().optional(),
});

const env = envSchema.parse(process.env);

// Connection pool with proper config
const queryClient = postgres(env.DATABASE_URL, {
  ...createPostgresOptions({
    maxConnections: env.DB_MAX_CONNECTIONS,
    searchPath: env.DB_SEARCH_PATH,
  }),
});

export const db = drizzle(queryClient, { schema });

// Health check function
export async function checkDbHealth(): Promise<boolean> {
  try {
    await queryClient`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}
