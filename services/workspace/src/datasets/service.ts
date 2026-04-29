import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { db } from '@pcp/db/src/client';
import { datasets } from '@pcp/db/src/schema';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { DuckDb, sanitizeTableName, type DuckDbColumn } from './driver';
import { env } from '../env';

export interface ImportOptions {
  userId: string;
  name: string;
  filePath: string; // local path to the uploaded file
  sourceFilename: string;
  sourceType: 'csv' | 'json' | 'parquet';
}

export interface QueryOptions {
  userId: string;
  sql: string;
  rowLimit?: number;
}

const DEFAULT_ROW_LIMIT = 1000;
const MAX_ROW_LIMIT = 10000;
const FILE_READING_FUNCTION_PATTERN =
  /\b(?:read_(?:csv|csv_auto|json|json_auto|ndjson|parquet|text)|parquet_scan|glob|sniff_csv)\s*\(/i;

export class DatasetsService {
  private dataDir: string;

  constructor(
    private logger?: {
      info: (...a: any[]) => void;
      warn: (...a: any[]) => void;
      error: (...a: any[]) => void;
    },
  ) {
    this.dataDir = path.resolve(env.DATASETS_DATA_DIR);
  }

  private dbPathFor(userId: string): string {
    return path.join(this.dataDir, `${userId}.duckdb`);
  }

  async list(userId: string) {
    return db
      .select()
      .from(datasets)
      .where(and(eq(datasets.userId, userId), isNull(datasets.deletedAt)))
      .orderBy(asc(datasets.name));
  }

  async get(userId: string, id: string) {
    const rows = await db
      .select()
      .from(datasets)
      .where(and(eq(datasets.id, id), eq(datasets.userId, userId), isNull(datasets.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Import a local file (CSV/JSON/Parquet) into the user's DuckDB and register the dataset. */
  async importFile(opts: ImportOptions) {
    const { userId, name, filePath, sourceFilename, sourceType } = opts;

    const stat = await fs.stat(filePath);
    const tableName = await this.uniqueTableName(userId, name);

    const duck = new DuckDb(this.dbPathFor(userId));
    const conn = await duck.connect();
    try {
      const reader = this.readerExpression(sourceType, filePath);
      // Atomic replace via CREATE OR REPLACE.
      await conn.run(`CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM ${reader}`);
      const desc = await conn.all(`DESCRIBE "${tableName}"`);
      const cols = desc.rows.map((r) => ({
        name: String(r[0]),
        type: String(r[1] ?? 'UNKNOWN'),
      }));
      const countRes = await conn.all(`SELECT count(*) FROM "${tableName}"`);
      const rowCount = Number(countRes.rows[0]?.[0] ?? 0);

      const inserted = await db
        .insert(datasets)
        .values({
          userId,
          name,
          tableName,
          sourceType,
          sourceFilename,
          columns: cols,
          rowCount,
          sizeBytes: stat.size,
        })
        .returning();
      return inserted[0]!;
    } finally {
      await conn.close().catch(() => {});
    }
  }

  /** Run a read-only SQL query, scoped to the user's DuckDB file. */
  async query(opts: QueryOptions) {
    const { userId, sql } = opts;
    const limit = Math.min(Math.max(opts.rowLimit ?? DEFAULT_ROW_LIMIT, 1), MAX_ROW_LIMIT);
    this.assertReadOnly(sql);

    const duck = new DuckDb(this.dbPathFor(userId));
    const conn = await duck.connect();
    const start = Date.now();
    try {
      // Wrap user SQL in a CTE to enforce a hard row cap regardless of LIMIT clauses.
      const wrapped = `SELECT * FROM (${sql.trim().replace(/;\s*$/, '')}) _q LIMIT ${limit + 1}`;
      const result = await conn.all(wrapped);
      const truncated = result.rows.length > limit;
      const rows = truncated ? result.rows.slice(0, limit) : result.rows;
      return {
        columns: result.columns satisfies DuckDbColumn[],
        rows,
        rowCount: rows.length,
        truncated,
        durationMs: Date.now() - start,
      };
    } finally {
      await conn.close().catch(() => {});
    }
  }

  async preview(userId: string, id: string, limit = 50) {
    const ds = await this.get(userId, id);
    if (!ds) throw Object.assign(new Error('Dataset not found'), { statusCode: 404 });
    return this.query({ userId, sql: `SELECT * FROM "${ds.tableName}"`, rowLimit: limit });
  }

  async remove(userId: string, id: string) {
    const ds = await this.get(userId, id);
    if (!ds) throw Object.assign(new Error('Dataset not found'), { statusCode: 404 });

    const duck = new DuckDb(this.dbPathFor(userId));
    const conn = await duck.connect();
    try {
      await conn.run(`DROP TABLE IF EXISTS "${ds.tableName}"`);
    } catch (err) {
      this.logger?.warn?.({ err, tableName: ds.tableName }, 'failed to drop duckdb table');
    } finally {
      await conn.close().catch(() => {});
    }
    await db
      .update(datasets)
      .set({ deletedAt: new Date() })
      .where(and(eq(datasets.id, id), eq(datasets.userId, userId), isNull(datasets.deletedAt)));
    return { success: true };
  }

  private readerExpression(sourceType: string, filePath: string): string {
    const escaped = filePath.replace(/'/g, "''");
    switch (sourceType) {
      case 'csv':
        return `read_csv_auto('${escaped}', sample_size=-1, header=true)`;
      case 'json':
        return `read_json_auto('${escaped}')`;
      case 'parquet':
        return `read_parquet('${escaped}')`;
      default:
        throw Object.assign(new Error(`Unsupported source type: ${sourceType}`), {
          statusCode: 400,
        });
    }
  }

  private async uniqueTableName(userId: string, name: string): Promise<string> {
    const base = sanitizeTableName(name);
    const existing = await db
      .select({ tableName: datasets.tableName })
      .from(datasets)
      .where(and(eq(datasets.userId, userId), isNull(datasets.deletedAt)));
    const taken = new Set(existing.map((r) => r.tableName));
    if (!taken.has(base)) return base;
    for (let i = 2; i < 1000; i++) {
      const cand = `${base}_${i}`;
      if (!taken.has(cand)) return cand;
    }
    return `${base}_${Date.now()}`;
  }

  /**
   * Block obvious mutating statements. DuckDB has no real read-only mode in the Node API,
   * so we do a coarse keyword check against the trimmed first token. Multi-statement input
   * is rejected by the trailing-semicolon strip + CTE wrapping in `query()`.
   */
  private assertReadOnly(sql: string) {
    const cleaned = sql
      .replace(/--[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim()
      .toLowerCase();
    if (!cleaned) throw Object.assign(new Error('Empty SQL'), { statusCode: 400 });
    if (/;\s*\S/.test(cleaned.replace(/;\s*$/, ''))) {
      throw Object.assign(new Error('Multiple statements are not allowed'), { statusCode: 400 });
    }
    if (FILE_READING_FUNCTION_PATTERN.test(cleaned)) {
      throw Object.assign(new Error('File-reading SQL functions are not allowed'), {
        statusCode: 400,
      });
    }
    const banned = [
      'insert ',
      'update ',
      'delete ',
      'drop ',
      'truncate ',
      'alter ',
      'create ',
      'attach ',
      'detach ',
      'copy ',
      'export ',
      'pragma ',
      'install ',
      'load ',
    ];
    for (const k of banned) {
      if (cleaned.startsWith(k) || cleaned.includes(` ${k}`)) {
        throw Object.assign(new Error(`Statement type "${k.trim()}" is not allowed`), {
          statusCode: 400,
        });
      }
    }
  }
}
