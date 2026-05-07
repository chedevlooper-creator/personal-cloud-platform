import { describe, expect, it } from 'vitest';
import { normalizeProfileValue } from './env-helpers';

const DOCKER_PROFILE_PATTERN = /^\/?[A-Za-z0-9][A-Za-z0-9_./:-]*$/;

describe('normalizeProfileValue', () => {
  it('normalizes empty profile values to undefined', () => {
    expect(normalizeProfileValue(undefined, 'RUNTIME_SECCOMP_PROFILE', DOCKER_PROFILE_PATTERN)).toBeUndefined();
    expect(normalizeProfileValue('   ', 'RUNTIME_SECCOMP_PROFILE', DOCKER_PROFILE_PATTERN)).toBeUndefined();
  });

  it('allows safe Docker profile values', () => {
    expect(
      normalizeProfileValue(
        '/etc/pcp/seccomp-runtime.json',
        'RUNTIME_SECCOMP_PROFILE',
        DOCKER_PROFILE_PATTERN,
      ),
    ).toBe('/etc/pcp/seccomp-runtime.json');
    expect(normalizeProfileValue('pcp-runtime', 'RUNTIME_APPARMOR_PROFILE', DOCKER_PROFILE_PATTERN)).toBe(
      'pcp-runtime',
    );
  });

  it('rejects profiles that disable or escape confinement', () => {
    expect(() => normalizeProfileValue('unconfined', 'RUNTIME_SECCOMP_PROFILE', DOCKER_PROFILE_PATTERN)).toThrow(
      'RUNTIME_SECCOMP_PROFILE must not disable confinement',
    );
    expect(() => normalizeProfileValue('../profile.json', 'RUNTIME_SECCOMP_PROFILE', DOCKER_PROFILE_PATTERN)).toThrow(
      'RUNTIME_SECCOMP_PROFILE contains invalid characters',
    );
    expect(() => normalizeProfileValue('bad profile', 'RUNTIME_APPARMOR_PROFILE', DOCKER_PROFILE_PATTERN)).toThrow(
      'RUNTIME_APPARMOR_PROFILE contains invalid characters',
    );
  });
});
