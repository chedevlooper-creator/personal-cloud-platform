import { z } from 'zod';
import { Tool, ToolContext } from './registry';
import { ToolDefinition } from '../llm/types';

export class AddMemoryTool
  implements Tool<{ content: string; type?: string; metadata?: unknown }, string>
{
  name = 'add_memory';
  description =
    "Save a durable note to the user's long-term memory. Use sparingly: capture stable facts, preferences, or important task summaries the user will benefit from later.";
  requiresApproval = false;
  schema = z.object({
    content: z.string().min(1).max(4_000).describe('Concise note to remember'),
    type: z
      .string()
      .optional()
      .describe('Memory type label, e.g. "fact", "preference", "task_summary"'),
    metadata: z.unknown().optional().describe('Optional structured metadata'),
  });

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Concise note to remember' },
          type: { type: 'string', description: 'Memory type label' },
          metadata: { type: 'object', description: 'Optional structured metadata' },
        },
        required: ['content'],
      },
    };
  }

  async execute(
    input: { content: string; type?: string; metadata?: unknown },
    context: ToolContext,
  ): Promise<string> {
    try {
      const entry = await context.clients.memory.add(
        context.userId,
        input.type ?? 'note',
        input.content,
        { metadata: input.metadata, workspaceId: context.workspaceId },
      );
      return `Saved memory ${entry.id} (type=${entry.type}).`;
    } catch (err: any) {
      return `Memory add error: ${err?.message ?? String(err)}`;
    }
  }
}
