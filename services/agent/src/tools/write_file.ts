import { z } from 'zod';
import { Tool, ToolContext } from './registry';
import { ToolDefinition } from '../llm/types';

export class WriteFileTool implements Tool<{ path: string; content: string }, string> {
  name = 'write_file';
  description = 'Writes content to a file in the workspace';
  requiresApproval = true;
  schema = z.object({
    path: z.string().describe('The path to the file relative to the workspace root'),
    content: z.string().describe('The content to write to the file'),
  });

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The path to the file relative to the workspace root' },
          content: { type: 'string', description: 'The content to write to the file' },
        },
        required: ['path', 'content']
      }
    };
  }

  async execute(input: { path: string; content: string }, _context: ToolContext): Promise<string> {
    // In a real implementation, this would call Workspace Service API
    return `Successfully wrote to ${input.path} (${input.content.length} bytes)`;
  }
}
