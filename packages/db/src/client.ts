import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { z } from 'zod';
import * as dotenv from 'dotenv';
import path from 'path';

// Load Docker defaults first; root .env can override for local development.
dotenv.config({ path: path.resolve(__dirname, '../../../infra/docker/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import * as schema from './schema';

// Environment variable validation with Zod
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DB_MAX_CONNECTIONS: z.coerce.number().default(10),
});

const env = envSchema.parse(process.env);

// Connection pool with proper config
const queryClient = postgres(env.DATABASE_URL, {
  max: env.DB_MAX_CONNECTIONS,
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
