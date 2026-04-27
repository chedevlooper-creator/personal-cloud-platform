import { z } from 'zod';
import { Tool, ToolContext } from './registry';
import { ToolDefinition } from '../llm/types';

export class SearchMemoryTool
  implements Tool<{ query: string; limit?: number; type?: string }, string>
{
  name = 'search_memory';
  description =
    "Search the user's long-term memory by semantic similarity. Returns the most relevant prior notes, facts, and task summaries.";
  requiresApproval = false;
  schema = z.object({
    query: z.string().min(1).describe('Natural-language query'),
    limit: z.number().int().min(1).max(20).optional().describe('Max results, default 5'),
    type: z.string().optional().describe('Filter by memory type (e.g. "fact", "preference")'),
  });

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Natural-language query' },
          limit: { type: 'number', description: 'Max results, default 5' },
          type: { type: 'string', description: 'Filter by memory type' },
        },
        required: ['query'],
      },
    };
  }

  async execute(
    input: { query: string; limit?: number; type?: string },
    context: ToolContext,
  ): Promise<string> {
    try {
      const results = await context.clients.memory.search(context.userId, input.query, {
        limit: input.limit ?? 5,
        type: input.type,
        workspaceId: context.workspaceId,
      });
      if (results.length === 0) return `No memories matched: ${input.query}`;
      return results
        .map((r, i) => {
          const sim = typeof r.similarity === 'number' ? ` (sim=${r.similarity.toFixed(3)})` : '';
          return `${i + 1}. [${r.type}]${sim}\n   ${r.content}`;
        })
        .join('\n\n');
    } catch (err: any) {
      return `Memory search error: ${err?.message ?? String(err)}`;
    }
  }
}
