import { z } from 'zod';
import { Tool, ToolContext } from './registry';
import { ToolDefinition } from '../llm/types';
import { internalRequest } from '../clients/http';
import { env } from '../env';

interface DatasetCatalogEntry {
  id: string;
  name: string;
  tableName: string;
  sourceType: string;
  sourceFilename: string | null;
  columns: Array<{ name: string; type: string }>;
  rowCount: number;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

const inputSchema = z.object({});

type Input = z.infer<typeof inputSchema>;

/**
 * List all datasets the user has imported. Returns a concise catalog
 * with table names, column counts, and row counts so the agent can
 * decide which dataset to query.
 */
export class ListDatasetsTool implements Tool<Input, string> {
  name = 'list_datasets';
  description =
    'List all datasets the user has imported. Returns table names, column counts, and row counts.';
  requiresApproval = false;
  schema = inputSchema;

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    };
  }

  async execute(_input: Input, context: ToolContext): Promise<string> {
    const res = await internalRequest<{ datasets: DatasetCatalogEntry[] }>(
      env.WORKSPACE_SERVICE_URL,
      {
        userId: context.userId,
        method: 'GET',
        path: '/api/datasets',
      },
    );

    const datasets = res.datasets ?? [];
    if (datasets.length === 0) {
      return 'No datasets found. Import a CSV, JSON, or Parquet file first.';
    }

    const lines = datasets.map((d) => {
      const cols = `${d.columns.length} columns`;
      const rows = `${d.rowCount.toLocaleString()} rows`;
      const size = formatBytes(d.sizeBytes);
      return `${d.name} (table: ${d.tableName}) — ${cols}, ${rows}, ${size}`;
    });

    return lines.join('\n');
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
