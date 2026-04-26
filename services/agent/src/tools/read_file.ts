import { z } from 'zod';
import { Tool, ToolContext } from './registry';
import { ToolDefinition } from '../llm/types';

export class ReadFileTool implements Tool<{ path: string }, string> {
  name = 'read_file';
  description = 'Reads a file from the workspace';
  requiresApproval = false;
  schema = z.object({
    path: z.string().describe('The path to the file relative to the workspace root'),
  });

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The path to the file relative to the workspace root' }
        },
        required: ['path']
      }
    };
  }

  async execute(input: { path: string }, _context: ToolContext): Promise<string> {
    // In a real implementation, this would call the Workspace Service API or interact with its DB directly.
    return `Simulated file content for ${input.path}`;
  }
}
