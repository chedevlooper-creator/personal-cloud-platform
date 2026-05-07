import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getFrontendSmokeFlows } from '../../../../scripts/frontend-smoke.mjs';

describe('frontend smoke contract', () => {
  it('covers the top three user flows', () => {
    const flows = getFrontendSmokeFlows();
    assert.deepEqual(
      flows.map((flow) => flow.name),
      ['login-to-workspace-open', 'send-chat-with-tool-call', 'deploy-static-site'],
    );
    for (const flow of flows) {
      assert.ok(flow.routes.length > 0, `${flow.name} must list routes`);
      assert.ok(flow.asserts.length > 0, `${flow.name} must list assertions`);
    }
  });
});
