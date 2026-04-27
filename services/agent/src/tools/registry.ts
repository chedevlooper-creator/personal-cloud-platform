import { z } from 'zod';
import { ToolDefinition } from '../llm/types';
import { WorkspaceClient } from '../clients/workspace';
import { RuntimeClient } from '../clients/runtime';
import { MemoryClient } from '../clients/memory';

export interface ToolContext {
  userId: string;
  workspaceId: string;
  taskId: string;
  /** Optional logger for tools to emit warnings/errors. */
  logger?: { info: (...args: any[]) => void; warn: (...args: any[]) => void; error: (...args: any[]) => void };
  /** Shared HTTP clients injected by the orchestrator. */
  clients: {
    workspace: WorkspaceClient;
    runtime: RuntimeClient;
    memory: MemoryClient;
  };
  /** Cached runtime id for the current task to avoid repeated `ensure` calls. */
  runtimeId?: string;
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
    return Array.from(this.tools.values()).map((t) => t.getDefinition());
  }

  /**
   * Validate and execute a tool. Throws if the tool requires approval — callers must use
   * `executeApproved` after the user has approved the call.
   */
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

  /**
   * Execute a tool whose approval has already been granted by the user.
   * Skips the requiresApproval check but still validates input against the schema.
   */
  async executeApproved(name: string, inputStr: string, context: ToolContext): Promise<any> {
    const tool = this.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);

    const input = JSON.parse(inputStr);
    const validatedInput = tool.schema.parse(input);

    return await tool.execute(validatedInput, context);
  }
}
