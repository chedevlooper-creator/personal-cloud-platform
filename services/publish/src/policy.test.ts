import { describe, expect, it } from 'vitest';
import {
  assertPublishImageAllowed,
  buildPublishSecurityOptions,
  resolvePublishImage,
} from './policy';

describe('publish image policy', () => {
  it('resolves hosted service kinds to allow-listed images', () => {
    expect(resolvePublishImage('node')).toBe('node:20-alpine');
    expect(resolvePublishImage('vite')).toBe('node:20-alpine');
    expect(resolvePublishImage('static')).toBe('nginxinc/nginx-unprivileged:alpine');
  });

  it('rejects images outside the publish allow-list', () => {
    expect(() => assertPublishImageAllowed('busybox:latest')).toThrow(
      'Publish image is not allowed',
    );
  });

  it('builds Docker security options with configured hardened profiles', () => {
    expect(
      buildPublishSecurityOptions({
        seccompProfile: '/etc/pcp/seccomp-publish.json',
        appArmorProfile: 'pcp-publish',
      }),
    ).toEqual([
      'no-new-privileges:true',
      'seccomp=/etc/pcp/seccomp-publish.json',
      'apparmor=pcp-publish',
    ]);
  });

  it('rejects unsafe Docker security profile values', () => {
    expect(() => buildPublishSecurityOptions({ seccompProfile: 'unconfined' })).toThrow(
      'PUBLISH_SECCOMP_PROFILE must not disable confinement',
    );
    expect(() => buildPublishSecurityOptions({ appArmorProfile: 'bad profile' })).toThrow(
      'PUBLISH_APPARMOR_PROFILE contains invalid characters',
    );
  });
});
