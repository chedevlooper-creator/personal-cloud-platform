import { z } from 'zod';
import { Tool, ToolContext } from './registry';
import { ToolDefinition } from '../llm/types';

const MAX_BYTES = 64 * 1024;

export class ReadFileTool implements Tool<{ path: string }, string> {
  name = 'read_file';
  description = 'Read a UTF-8 text file from the current workspace and return its contents.';
  requiresApproval = false;
  schema = z.object({
    path: z.string().describe('Path to the file relative to the workspace root, e.g. /src/index.ts'),
  });

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file relative to the workspace root' },
        },
        required: ['path'],
      },
    };
  }

  async execute(input: { path: string }, context: ToolContext): Promise<string> {
    try {
      const file = await context.clients.workspace.getFileContent(
        context.userId,
        context.workspaceId,
        input.path,
      );
      const content = file.content ?? '';
      if (content.length > MAX_BYTES) {
        return `${content.slice(0, MAX_BYTES)}\n[truncated: ${content.length - MAX_BYTES} more bytes]`;
      }
      return content;
    } catch (err: any) {
      const status = err?.status ?? 'unknown';
      return `Error reading ${input.path} (status=${status}): ${err?.message ?? String(err)}`;
    }
  }
}
