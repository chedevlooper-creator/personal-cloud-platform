import { z } from 'zod';
import { Tool, ToolContext } from './registry';
import { ToolDefinition } from '../llm/types';

const MAX_OUTPUT_BYTES = 32 * 1024;

export const RUN_COMMAND_POLICY = {
  approvalRequired: true,
  timeoutMs: 60_000,
  network: 'disabled',
  outputLimitBytes: MAX_OUTPUT_BYTES,
  blockedCategories: ['destructive root deletion', 'privilege escalation', 'fork bomb'],
} as const;

function trim(value: string): string {
  if (value.length <= MAX_OUTPUT_BYTES) return value;
  return `${value.slice(0, MAX_OUTPUT_BYTES)}\n[truncated: ${value.length - MAX_OUTPUT_BYTES} more bytes]`;
}

function formatPolicyDescription(): string {
  return [
    'Approval required',
    `${RUN_COMMAND_POLICY.timeoutMs / 1000}s timeout`,
    `network ${RUN_COMMAND_POLICY.network}`,
    `output truncated to ${RUN_COMMAND_POLICY.outputLimitBytes / 1024}KB`,
    `blocked: ${RUN_COMMAND_POLICY.blockedCategories.join(', ')}`,
  ].join('; ');
}

export class RunCommandTool implements Tool<{ command: string }, string> {
  name = 'run_command';
  description = `Run a shell command inside the workspace runtime container (sh -c). ${formatPolicyDescription()}.`;
  requiresApproval = true;
  schema = z.object({
    command: z.string().min(1).describe('Shell command to run, e.g. "node -v"'),
  });

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to run' },
        },
        required: ['command'],
      },
    };
  }

  async execute(input: { command: string }, context: ToolContext): Promise<string> {
    try {
      let runtimeId = context.runtimeId;
      if (!runtimeId) {
        const runtime = await context.clients.runtime.ensureForWorkspace(
          context.userId,
          context.workspaceId,
        );
        runtimeId = runtime.id;
        context.runtimeId = runtimeId;
      }

      const result = await context.clients.runtime.exec(context.userId, runtimeId, [
        '/bin/sh',
        '-c',
        input.command,
      ]);
      const parts: string[] = [];
      parts.push(`exit=${result.exitCode}`);
      if (result.stdout) parts.push(`stdout:\n${trim(result.stdout)}`);
      if (result.stderr) parts.push(`stderr:\n${trim(result.stderr)}`);
      return parts.join('\n\n');
    } catch (err: any) {
      const status = err?.status ?? 'unknown';
      return `Error running command (status=${status}): ${err?.message ?? String(err)}`;
    }
  }
}
