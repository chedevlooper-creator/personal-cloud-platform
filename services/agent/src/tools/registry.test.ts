import { describe, it, expect } from 'vitest';
import { ToolRegistry, Tool, ToolContext } from './registry';
import { z } from 'zod';

const mockContext = {
  userId: 'u1',
  workspaceId: 'w1',
  taskId: 't1',
  clients: {} as any,
} satisfies ToolContext;

describe('ToolRegistry', () => {
  it('throws a readable error when tool arguments are invalid JSON', async () => {
    const registry = new ToolRegistry();
    const tool: Tool<{ path: string }, string> = {
      name: 'read_file',
      description: 'Read a file',
      schema: z.object({ path: z.string() }),
      requiresApproval: false,
      async execute(input) {
        return input.path;
      },
      getDefinition() {
        return { name: this.name, description: this.description, parameters: {} };
      },
    };
    registry.register(tool);

    await expect(
      registry.execute('read_file', '{invalid json}', mockContext),
    ).rejects.toThrow('Invalid JSON arguments for tool "read_file"');
  });

  it('executes normally with valid JSON arguments', async () => {
    const registry = new ToolRegistry();
    const tool: Tool<{ path: string }, string> = {
      name: 'read_file',
      description: 'Read a file',
      schema: z.object({ path: z.string() }),
      requiresApproval: false,
      async execute(input) {
        return `content of ${input.path}`;
      },
      getDefinition() {
        return { name: this.name, description: this.description, parameters: {} };
      },
    };
    registry.register(tool);

    const result = await registry.execute(
      'read_file',
      JSON.stringify({ path: '/hello.txt' }),
      mockContext,
    );
    expect(result).toBe('content of /hello.txt');
  });

  it('throws approval error before parsing when tool requires approval', async () => {
    const registry = new ToolRegistry();
    const tool: Tool<{ command: string }, string> = {
      name: 'run_command',
      description: 'Run a shell command',
      schema: z.object({ command: z.string() }),
      requiresApproval: true,
      async execute(input) {
        return input.command;
      },
      getDefinition() {
        return { name: this.name, description: this.description, parameters: {} };
      },
    };
    registry.register(tool);

    await expect(
      registry.execute('run_command', JSON.stringify({ command: 'ls' }), mockContext),
    ).rejects.toThrow('Tool requires approval: run_command');
  });
});
