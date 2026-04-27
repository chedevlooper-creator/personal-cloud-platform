import { z } from 'zod';
import { Tool, ToolContext } from './registry';
import { ToolDefinition } from '../llm/types';

export class ListFilesTool implements Tool<{ path: string }, string> {
  name = 'list_files';
  description = 'Lists files in a directory within the workspace';
  requiresApproval = false;
  schema = z.object({
    path: z.string().describe('The path to the directory relative to the workspace root'),
  });

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The path to the directory relative to the workspace root' },
        },
        required: ['path']
      }
    };
  }

  async execute(input: { path: string }, _context: ToolContext): Promise<string> {
    // In a real implementation, this would call Workspace Service API
    return `Simulated file listing for ${input.path}:\n- README.md\n- src/`;
  }
}
