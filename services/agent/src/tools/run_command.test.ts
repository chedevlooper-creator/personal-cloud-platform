import { describe, expect, it } from 'vitest';
import { RUN_COMMAND_POLICY, RunCommandTool } from './run_command';

describe('RunCommandTool policy metadata', () => {
  it('exposes approval, timeout, network, and blocked command policy in its definition', () => {
    const tool = new RunCommandTool();
    const definition = tool.getDefinition();

    expect(tool.requiresApproval).toBe(true);
    expect(RUN_COMMAND_POLICY).toMatchObject({
      approvalRequired: true,
      timeoutMs: 60_000,
      network: 'disabled',
    });
    expect(definition.description).toContain('Approval required');
    expect(definition.description).toContain('60s timeout');
    expect(definition.description).toContain('network disabled');
    expect(definition.description).toContain('blocked: destructive root deletion');
  });
});
