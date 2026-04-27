import { z } from 'zod';
import { Tool, ToolContext } from './registry';
import { ToolDefinition } from '../llm/types';

export class RunCommandTool implements Tool<{ command: string }, string> {
  name = 'run_command';
  description = 'Runs a shell command in the workspace terminal';
  requiresApproval = true;
  schema = z.object({
    command: z.string().describe('The shell command to run'),
  });

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to run' },
        },
        required: ['command']
      }
    };
  }

  async execute(input: { command: string }, _context: ToolContext): Promise<string> {
    // In a real implementation, this would call Runtime Service API
    return `Simulated execution of: ${input.command}\nOutput: command executed successfully.`;
  }
}
