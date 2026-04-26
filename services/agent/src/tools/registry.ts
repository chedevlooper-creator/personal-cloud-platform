import { z } from 'zod';
import { ToolDefinition } from '../llm/types';

export interface ToolContext {
  userId: string;
  workspaceId: string;
  taskId: string;
}

export interface Tool<TInput = any, TOutput = any> {
  name: string;
  description: string;
  schema: z.ZodType<TInput>;
  requiresApproval: boolean;
  execute(input: TInput, context: ToolContext): Promise<TOutput>;
  getDefinition(): ToolDefinition;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAllDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.getDefinition());
  }

  async execute(name: string, inputStr: string, context: ToolContext): Promise<any> {
    const tool = this.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);

    const input = JSON.parse(inputStr);
    const validatedInput = tool.schema.parse(input);

    if (tool.requiresApproval) {
      throw new Error(`Tool requires approval: ${name}`);
    }

    return await tool.execute(validatedInput, context);
  }
}
