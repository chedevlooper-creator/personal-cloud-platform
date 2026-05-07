import { describe, expect, it } from 'vitest';
import {
  assertSandboxCommandAllowed,
  getBlockedSandboxCommandCategories,
  normalizeSandboxProfile,
  SANDBOX_COMMAND_POLICY,
} from './sandbox-policy';

describe('sandbox command policy profiles', () => {
  it('normalizes unknown or legacy profile values to balanced', () => {
    expect(normalizeSandboxProfile('strict')).toBe('strict');
    expect(normalizeSandboxProfile('permissive')).toBe('permissive');
    expect(normalizeSandboxProfile('normal')).toBe('balanced');
    expect(normalizeSandboxProfile(undefined)).toBe('balanced');
  });

  it('keeps critical blocked commands blocked in strict profile', () => {
    expect(getBlockedSandboxCommandCategories('strict')).toEqual([
      'destructive root deletion',
      'privilege escalation',
      'fork bomb',
      'network fetcher',
      'package install',
    ]);
    expect(() => assertSandboxCommandAllowed(['/bin/sh', '-c', 'rm -rf /'], 'strict')).toThrow(
      'Command blocked by security policy',
    );
    expect(() => assertSandboxCommandAllowed(['/bin/sh', '-c', 'curl https://example.com'], 'strict')).toThrow(
      'Command blocked by security policy',
    );
    expect(() => assertSandboxCommandAllowed(['/bin/sh', '-c', 'npm install lodash'], 'strict')).toThrow(
      'Command blocked by security policy',
    );
  });

  it('keeps critical and network blocked commands blocked in balanced profile', () => {
    expect(getBlockedSandboxCommandCategories('balanced')).toEqual([
      'destructive root deletion',
      'privilege escalation',
      'fork bomb',
      'network fetcher',
    ]);
    expect(() => assertSandboxCommandAllowed(['/bin/sh', '-c', 'sudo id'], 'balanced')).toThrow(
      'Command blocked by security policy',
    );
    expect(() => assertSandboxCommandAllowed(['/bin/sh', '-c', 'wget https://example.com'], 'balanced')).toThrow(
      'Command blocked by security policy',
    );
    expect(() => assertSandboxCommandAllowed(['/bin/sh', '-c', 'npm install'], 'balanced')).not.toThrow();
  });

  it('keeps critical blocked commands blocked in permissive profile', () => {
    expect(getBlockedSandboxCommandCategories('permissive')).toEqual([
      'destructive root deletion',
      'privilege escalation',
      'fork bomb',
    ]);
    expect(() => assertSandboxCommandAllowed(['/bin/sh', '-c', ':(){ :|:& };:'], 'permissive')).toThrow(
      'Command blocked by security policy',
    );
    expect(() => assertSandboxCommandAllowed(['/bin/sh', '-c', 'curl https://example.com'], 'permissive')).not.toThrow();
  });

  it('blocks malformed argv across every profile', () => {
    for (const profile of SANDBOX_COMMAND_POLICY.profiles) {
      expect(() => assertSandboxCommandAllowed([], profile)).toThrow(
        'Command blocked by security policy',
      );
      expect(() => assertSandboxCommandAllowed(['node', 'bad\0arg'], profile)).toThrow(
        'Command blocked by security policy',
      );
      expect(() => assertSandboxCommandAllowed(Array.from({ length: 65 }, () => 'true'), profile)).toThrow(
        'Command blocked by security policy',
      );
    }
  });
});
