import { z } from 'zod';
import { Tool, ToolContext } from './registry';
import { ToolDefinition } from '../llm/types';

export class WriteFileTool implements Tool<{ path: string; content: string; mimeType?: string }, string> {
  name = 'write_file';
  description = 'Create or overwrite a UTF-8 text file in the current workspace.';
  requiresApproval = true;
  schema = z.object({
    path: z.string().describe('Path to the file relative to the workspace root'),
    content: z.string().describe('Full text content to write'),
    mimeType: z.string().optional().describe('Optional MIME type, defaults to text/plain'),
  });

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file relative to the workspace root' },
          content: { type: 'string', description: 'Full text content to write' },
          mimeType: { type: 'string', description: 'Optional MIME type, defaults to text/plain' },
        },
        required: ['path', 'content'],
      },
    };
  }

  async execute(
    input: { path: string; content: string; mimeType?: string },
    context: ToolContext,
  ): Promise<string> {
    try {
      const result = await context.clients.workspace.writeFile(
        context.userId,
        context.workspaceId,
        input.path,
        input.content,
        input.mimeType ?? 'text/plain',
      );
      return `Wrote ${result.bytesWritten} bytes to ${input.path}`;
    } catch (err: any) {
      const status = err?.status ?? 'unknown';
      return `Error writing ${input.path} (status=${status}): ${err?.message ?? String(err)}`;
    }
  }
}
