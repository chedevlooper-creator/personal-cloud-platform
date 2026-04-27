import { promises as fs } from 'node:fs';
import * as path from 'node:path';

/**
 * Lazy DuckDB driver. We dynamically import @duckdb/node-api so the workspace-service
 * still boots and `tsc` succeeds when the native binary is not installed (the routes
 * surface a 503 with an install hint instead of crashing the service).
 */

export type DuckDbColumn = { name: string; type: string };

export interface DuckDbConnection {
  run(sql: string, params?: unknown[]): Promise<void>;
  all(sql: string, params?: unknown[]): Promise<{ columns: DuckDbColumn[]; rows: unknown[][] }>;
  close(): Promise<void>;
}

let driverModule: any | null = null;
let driverError: string | null = null;

async function loadDriver(): Promise<any> {
  if (driverModule) return driverModule;
  if (driverError) throw new Error(driverError);
  try {
    // Indirect specifier prevents TS from resolving the module at build time so the
    // service compiles even when the optional native dependency isn't installed.
    const specifier = '@duckdb/node-api';
    const mod = await (Function('s', 'return import(s)') as (s: string) => Promise<any>)(specifier);
    driverModule = mod;
    return mod;
  } catch (err) {
    driverError = `DuckDB native binding not available. Install with "pnpm --filter @pcp/workspace-service add @duckdb/node-api". Original error: ${(err as Error).message}`;
    throw new Error(driverError);
  }
}

export function isDuckDbAvailable(): boolean {
  return driverError === null;
}

export class DuckDb {
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async connect(): Promise<DuckDbConnection> {
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
    const mod = await loadDriver();
    const instance = await mod.DuckDBInstance.create(this.dbPath);
    const conn = await instance.connect();

    return {
      async run(sql: string, params: unknown[] = []) {
        if (params.length === 0) {
          await conn.run(sql);
        } else {
          const prepared = await conn.prepare(sql);
          for (let i = 0; i < params.length; i++) {
            prepared.bind(i + 1, params[i]);
          }
          await prepared.run();
        }
      },
      async all(sql: string, params: unknown[] = []) {
        const reader = params.length === 0 ? await conn.runAndReadAll(sql) : await runPrepared(conn, sql, params);
        const cols = reader.columnNames();
        const types = reader.columnTypes().map((t: any) => String(t?.toString?.() ?? t));
        const rows = reader.getRowsJson();
        const columns: DuckDbColumn[] = cols.map((name: string, i: number) => ({
          name,
          type: types[i] ?? 'UNKNOWN',
        }));
        return { columns, rows: rows as unknown[][] };
      },
      async close() {
        await conn.disconnectSync?.();
        await instance.disconnectSync?.();
      },
    };
  }
}

async function runPrepared(conn: any, sql: string, params: unknown[]) {
  const prepared = await conn.prepare(sql);
  for (let i = 0; i < params.length; i++) {
    prepared.bind(i + 1, params[i]);
  }
  return prepared.runAndReadAll();
}

/** Sanitize a name so it is a safe DuckDB identifier (letters/digits/underscore, 1-120). */
export function sanitizeTableName(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
  if (!base) return `t_${Date.now()}`;
  // DuckDB identifiers can't start with a digit unsafely without quoting; prefix.
  return /^[a-z]/.test(base) ? base : `t_${base}`;
}
