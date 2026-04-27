import { describe, expect, it, vi } from 'vitest';

vi.mock('@pcp/db/src/client', () => ({ db: {} }));

const { automationTriggerToken, verifyAutomationTriggerToken } = await import('./notify');

describe('automation trigger tokens', () => {
  it('round-trips a valid token', () => {
    const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const token = automationTriggerToken(id);
    expect(token).toMatch(/^[a-f0-9]{32}$/);
    expect(verifyAutomationTriggerToken(id, token)).toBe(true);
  });

  it('rejects tampered tokens and tokens for other automations', () => {
    const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const otherId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const token = automationTriggerToken(id);

    expect(verifyAutomationTriggerToken(id, token.slice(0, -1) + '0')).toBe(false);
    expect(verifyAutomationTriggerToken(otherId, token)).toBe(false);
    expect(verifyAutomationTriggerToken(id, '')).toBe(false);
  });
});
