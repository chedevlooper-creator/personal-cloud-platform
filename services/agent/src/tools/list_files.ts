import { z } from 'zod';
import { Tool, ToolContext } from './registry';
import { ToolDefinition } from '../llm/types';

export class ListFilesTool implements Tool<{ path: string }, string> {
  name = 'list_files';
  description = 'List immediate children (files and directories) of a directory in the workspace.';
  requiresApproval = false;
  schema = z.object({
    path: z.string().describe('Directory path relative to workspace root, e.g. / or /src'),
  });

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path relative to workspace root' },
        },
        required: ['path'],
      },
    };
  }

  async execute(input: { path: string }, context: ToolContext): Promise<string> {
    try {
      const files = await context.clients.workspace.listFiles(
        context.userId,
        context.workspaceId,
        input.path,
      );
      if (files.length === 0) {
        return `(empty directory: ${input.path})`;
      }
      const lines = files.map((f) => {
        const marker = f.isDirectory ? 'd' : 'f';
        const size = f.isDirectory ? '-' : `${f.size}b`;
        return `${marker} ${size}\t${f.path}`;
      });
      return `Listing of ${input.path}:\n${lines.join('\n')}`;
    } catch (err: any) {
      const status = err?.status ?? 'unknown';
      return `Error listing ${input.path} (status=${status}): ${err?.message ?? String(err)}`;
    }
  }
}
