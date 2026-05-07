import {
  assertSandboxCommandAllowed,
  getBlockedSandboxCommandCategories,
  normalizeProfileValue,
  normalizeSandboxProfile,
  SANDBOX_COMMAND_POLICY,
} from '@pcp/shared';
import { env } from './env';

type PublishKind = 'static' | 'vite' | 'node';

type DockerSecurityProfileConfig = {
  seccompProfile?: string;
  appArmorProfile?: string;
};

export const PUBLISH_IMAGE_ALLOWLIST = [
  'node:20-alpine',
  'nginxinc/nginx-unprivileged:alpine',
] as const;

export const PUBLISH_COMMAND_POLICY = {
  timeoutMs: SANDBOX_COMMAND_POLICY.timeoutMs,
  network: 'restricted-publish-network',
  profiles: SANDBOX_COMMAND_POLICY.profiles,
  blockedCategories: SANDBOX_COMMAND_POLICY.blockedCategories,
} as const;

const DOCKER_NO_NEW_PRIVILEGES = 'no-new-privileges:true';
const SECCOMP_PROFILE_PATTERN = /^\/?[A-Za-z0-9][A-Za-z0-9_./:-]*$/;
const APPARMOR_PROFILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;

const PUBLISH_IMAGE_BY_KIND: Record<PublishKind, (typeof PUBLISH_IMAGE_ALLOWLIST)[number]> = {
  node: 'node:20-alpine',
  vite: 'node:20-alpine',
  static: 'nginxinc/nginx-unprivileged:alpine',
};

export function resolvePublishImage(kind: PublishKind): string {
  const image = PUBLISH_IMAGE_BY_KIND[kind];
  assertPublishImageAllowed(image);
  return image;
}

export function assertPublishImageAllowed(image: string): void {
  if (!PUBLISH_IMAGE_ALLOWLIST.includes(image as (typeof PUBLISH_IMAGE_ALLOWLIST)[number])) {
    throw new Error('Publish image is not allowed');
  }
}

export function assertPublishCommandAllowed(
  command: readonly string[],
  profile = env.PUBLISH_SANDBOX_PROFILE,
): void {
  assertSandboxCommandAllowed(command, normalizeSandboxProfile(profile));
}

export function getPublishBlockedCommandCategories(
  profile = env.PUBLISH_SANDBOX_PROFILE,
): readonly string[] {
  return getBlockedSandboxCommandCategories(normalizeSandboxProfile(profile));
}

export function buildPublishSecurityOptions(config: DockerSecurityProfileConfig = {}): string[] {
  const securityOptions = [DOCKER_NO_NEW_PRIVILEGES];
  const seccompProfile = normalizeProfileValue(
    config.seccompProfile,
    'PUBLISH_SECCOMP_PROFILE',
    SECCOMP_PROFILE_PATTERN,
  );
  const appArmorProfile = normalizeProfileValue(
    config.appArmorProfile,
    'PUBLISH_APPARMOR_PROFILE',
    APPARMOR_PROFILE_PATTERN,
  );

  if (seccompProfile) securityOptions.push(`seccomp=${seccompProfile}`);
  if (appArmorProfile) securityOptions.push(`apparmor=${appArmorProfile}`);
  return securityOptions;
}
