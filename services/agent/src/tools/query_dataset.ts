import { z } from 'zod';
import { Tool, ToolContext } from './registry';
import { ToolDefinition } from '../llm/types';
import { internalRequest } from '../clients/http';
import { env } from '../env';

const inputSchema = z.object({
  sql: z
    .string()
    .min(1)
    .max(20000)
    .describe('Read-only DuckDB SQL. The active dataset is referenced by its tableName.'),
  rowLimit: z.number().int().min(1).max(1000).optional(),
});

type Input = z.infer<typeof inputSchema>;

interface QueryResponse {
  columns: Array<{ name: string; type: string }>;
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
  durationMs: number;
}

const PREVIEW_ROWS = 20;

/**
 * Run a read-only SQL query against the user's DuckDB datasets via workspace-service.
 * Returns a compact text rendering capped at PREVIEW_ROWS rows so the LLM can reason
 * over results without overflowing the context window.
 */
export class QueryDatasetTool implements Tool<Input, string> {
  name = 'query_dataset';
  description =
    'Run a read-only SQL query against the user\'s registered datasets (DuckDB). ' +
    'Use list_datasets-style table names from the dataset catalog. INSERT/UPDATE/DELETE/DDL not allowed.';
  requiresApproval = false;
  schema = inputSchema;

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          sql: {
            type: 'string',
            description: 'Read-only DuckDB SQL referencing dataset tables by their tableName.',
          },
          rowLimit: {
            type: 'number',
            description: 'Optional row cap (default 1000, max 1000 visible to the agent).',
          },
        },
        required: ['sql'],
      },
    };
  }

  async execute(input: Input, context: ToolContext): Promise<string> {
    const limit = Math.min(input.rowLimit ?? 200, 1000);
    const result = await internalRequest<QueryResponse>(env.WORKSPACE_SERVICE_URL, {
      userId: context.userId,
      method: 'POST',
      path: '/api/datasets/query',
      body: { sql: input.sql, rowLimit: limit },
    });

    const head = result.rows.slice(0, PREVIEW_ROWS);
    const headerLine = result.columns.map((c) => c.name).join(' | ');
    const body = head
      .map((row) => row.map((v) => formatCell(v)).join(' | '))
      .join('\n');
    const more = result.rowCount > head.length ? `\n…(${result.rowCount - head.length} more rows)` : '';
    const truncatedNote = result.truncated ? '\n[server truncated to row cap]' : '';
    return `${headerLine}\n${body}${more}${truncatedNote}\n(${result.rowCount} rows, ${result.durationMs}ms)`;
  }
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'string') return v.length > 80 ? v.slice(0, 77) + '…' : v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
