import { z } from 'zod';
import { ToolDefinition } from '../llm/types';
import { WorkspaceClient } from '../clients/workspace';
import { RuntimeClient } from '../clients/runtime';
import { MemoryClient } from '../clients/memory';
import type { MCPClient } from '../mcp/client';

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
   * Register tools exposed by an MCP server as first-class registry entries.
   * The MCP server is responsible for parameter validation; we accept any object.
   */
  registerMCP(client: MCPClient, serverName: string): void {
    for (const mcpTool of client.getTools()) {
      const toolName = `${serverName}_${mcpTool.name}`;
      const tool: Tool<Record<string, unknown>, unknown> = {
        name: toolName,
        description: `[MCP ${serverName}] ${mcpTool.description}`,
        schema: z.record(z.any()),
        requiresApproval: false,
        async execute(input: Record<string, unknown>) {
          return client.invokeTool(mcpTool.name, input);
        },
        getDefinition(): ToolDefinition {
          return {
            name: toolName,
            description: `[MCP ${serverName}] ${mcpTool.description}`,
            parameters: mcpTool.parameters,
          };
        },
      };
      this.register(tool);
    }
  }

  /**
   * Validate and execute a tool. Throws if the tool requires approval — callers must use
   * `executeApproved` after the user has approved the call.
   */
  async execute(name: string, inputStr: string, context: ToolContext): Promise<any> {
    const tool = this.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);

    const input = safeParseToolInput(inputStr, name);
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

    const input = safeParseToolInput(inputStr, name);
    const validatedInput = tool.schema.parse(input);

    return await tool.execute(validatedInput, context);
  }
}

function safeParseToolInput(inputStr: string, toolName: string): unknown {
  try {
    return JSON.parse(inputStr);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    throw new Error(
      `Invalid JSON arguments for tool "${toolName}": ${message}. ` +
        `Please ensure the tool arguments are valid JSON.`,
    );
  }
}
