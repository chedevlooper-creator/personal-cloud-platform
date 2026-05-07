import { describe, expect, it } from 'vitest';
import {
  assertPublishCommandAllowed,
  assertPublishImageAllowed,
  buildPublishSecurityOptions,
  getPublishBlockedCommandCategories,
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

  it('keeps strict profile regression commands blocked', () => {
    expect(getPublishBlockedCommandCategories('strict')).toEqual([
      'destructive root deletion',
      'privilege escalation',
      'fork bomb',
      'network fetcher',
      'package install',
    ]);
    expect(() => assertPublishCommandAllowed(['sh', '-c', 'npm install'], 'strict')).toThrow(
      'Command blocked by security policy',
    );
  });

  it('keeps balanced profile regression commands blocked', () => {
    expect(getPublishBlockedCommandCategories('balanced')).toEqual([
      'destructive root deletion',
      'privilege escalation',
      'fork bomb',
      'network fetcher',
    ]);
    expect(() => assertPublishCommandAllowed(['sh', '-c', 'curl https://example.com'], 'balanced')).toThrow(
      'Command blocked by security policy',
    );
    expect(() => assertPublishCommandAllowed(['sh', '-c', 'npm install'], 'balanced')).not.toThrow();
  });

  it('keeps permissive profile regression commands blocked', () => {
    expect(getPublishBlockedCommandCategories('permissive')).toEqual([
      'destructive root deletion',
      'privilege escalation',
      'fork bomb',
    ]);
    expect(() => assertPublishCommandAllowed(['sh', '-c', 'sudo id'], 'permissive')).toThrow(
      'Command blocked by security policy',
    );
    expect(() => assertPublishCommandAllowed(['sh', '-c', 'curl https://example.com'], 'permissive')).not.toThrow();
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
