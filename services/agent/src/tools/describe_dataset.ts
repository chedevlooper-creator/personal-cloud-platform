import { z } from 'zod';
import { Tool, ToolContext } from './registry';
import { ToolDefinition } from '../llm/types';
import { internalRequest } from '../clients/http';
import { env } from '../env';

interface DatasetPreviewResponse {
  columns: Array<{ name: string; type: string }>;
  rows: unknown[][];
  rowCount: number;
}

const inputSchema = z.object({
  tableName: z
    .string()
    .min(1)
    .max(128)
    .describe('The tableName from list_datasets output (not the display name).'),
});

type Input = z.infer<typeof inputSchema>;

/**
 * Show the schema and first few rows of a dataset so the agent can
 * understand its structure before writing queries.
 */
export class DescribeDatasetTool implements Tool<Input, string> {
  name = 'describe_dataset';
  description =
    'Show the schema and first rows of a dataset. Use the tableName from list_datasets.';
  requiresApproval = false;
  schema = inputSchema;

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          tableName: {
            type: 'string',
            description: 'The tableName from list_datasets output (not the display name).',
          },
        },
        required: ['tableName'],
      },
    };
  }

  async execute(input: Input, context: ToolContext): Promise<string> {
    const res = await internalRequest<DatasetPreviewResponse>(
      env.WORKSPACE_SERVICE_URL,
      {
        userId: context.userId,
        method: 'POST',
        path: '/api/datasets/query',
        body: { sql: `SELECT * FROM "${input.tableName}" LIMIT 5`, rowLimit: 5 },
      },
    );

    const headerLine = res.columns.map((c) => `${c.name} (${c.type})`).join(' | ');
    const body = res.rows
      .slice(0, 5)
      .map((row) => row.map(formatCell).join(' | '))
      .join('\n');

    return `Schema: ${res.columns.length} columns, ${res.rowCount.toLocaleString()} total rows\n\n${headerLine}\n${body}\n\n(Showing first ${Math.min(res.rows.length, 5)} of ${res.rowCount.toLocaleString()} rows)`;
  }
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'string') return v.length > 60 ? v.slice(0, 57) + '…' : v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
