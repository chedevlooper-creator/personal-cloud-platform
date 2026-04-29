import { describe, expect, it } from 'vitest';
import {
  assertRuntimeCommandAllowed,
  assertRuntimeImageAllowed,
  buildRuntimeSecurityOptions,
} from './policy';

describe('runtime sandbox policy', () => {
  it('allows only approved runtime images', () => {
    expect(() => assertRuntimeImageAllowed('node:20-alpine')).not.toThrow();
    expect(() => assertRuntimeImageAllowed('busybox:latest')).toThrow(
      'Runtime image is not allowed',
    );
  });

  it('blocks high-risk command categories', () => {
    expect(() => assertRuntimeCommandAllowed(['/bin/sh', '-c', 'rm -rf /'])).toThrow(
      'Command blocked by security policy',
    );
    expect(() => assertRuntimeCommandAllowed(['/bin/sh', '-c', 'sudo id'])).toThrow(
      'Command blocked by security policy',
    );
    expect(() => assertRuntimeCommandAllowed(['/bin/sh', '-c', 'npm test'])).not.toThrow();
  });

  it('blocks malformed command argv before Docker exec', () => {
    expect(() => assertRuntimeCommandAllowed([])).toThrow('Command blocked by security policy');
    expect(() => assertRuntimeCommandAllowed([''])).toThrow('Command blocked by security policy');
    expect(() => assertRuntimeCommandAllowed(['node', 'bad\0arg'])).toThrow(
      'Command blocked by security policy',
    );
    expect(() => assertRuntimeCommandAllowed(Array.from({ length: 65 }, () => 'true'))).toThrow(
      'Command blocked by security policy',
    );
  });

  it('builds Docker security options with configured hardened profiles', () => {
    expect(
      buildRuntimeSecurityOptions({
        seccompProfile: '/etc/pcp/seccomp-runtime.json',
        appArmorProfile: 'pcp-runtime',
      }),
    ).toEqual([
      'no-new-privileges:true',
      'seccomp=/etc/pcp/seccomp-runtime.json',
      'apparmor=pcp-runtime',
    ]);
  });

  it('rejects unsafe Docker security profile values', () => {
    expect(() => buildRuntimeSecurityOptions({ seccompProfile: 'unconfined' })).toThrow(
      'RUNTIME_SECCOMP_PROFILE must not disable confinement',
    );
    expect(() => buildRuntimeSecurityOptions({ appArmorProfile: 'bad profile' })).toThrow(
      'RUNTIME_APPARMOR_PROFILE contains invalid characters',
    );
  });
});
