import { env } from './env';
import {
  assertSandboxCommandAllowed,
  getBlockedSandboxCommandCategories,
  normalizeProfileValue,
  normalizeSandboxProfile,
  SANDBOX_COMMAND_POLICY,
} from '@pcp/shared';

type DockerSecurityProfileConfig = {
  seccompProfile?: string;
  appArmorProfile?: string;
};

const DOCKER_NO_NEW_PRIVILEGES = 'no-new-privileges:true';
const SECCOMP_PROFILE_PATTERN = /^\/?[A-Za-z0-9][A-Za-z0-9_./:-]*$/;
const APPARMOR_PROFILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;

export const RUNTIME_COMMAND_POLICY = {
  timeoutMs: SANDBOX_COMMAND_POLICY.timeoutMs,
  network: 'disabled',
  profiles: SANDBOX_COMMAND_POLICY.profiles,
  blockedCategories: SANDBOX_COMMAND_POLICY.blockedCategories,
} as const;

export function getRuntimeImageAllowlist(): string[] {
  return env.RUNTIME_IMAGE_ALLOWLIST;
}

export function assertRuntimeImageAllowed(image: string): void {
  if (!getRuntimeImageAllowlist().includes(image)) {
    throw new Error('Runtime image is not allowed');
  }
}

export function assertRuntimeCommandAllowed(
  command: readonly string[],
  profile = env.RUNTIME_SANDBOX_PROFILE,
): void {
  assertSandboxCommandAllowed(command, normalizeSandboxProfile(profile));
}

export function getRuntimeBlockedCommandCategories(
  profile = env.RUNTIME_SANDBOX_PROFILE,
): readonly string[] {
  return getBlockedSandboxCommandCategories(normalizeSandboxProfile(profile));
}

export function buildRuntimeSecurityOptions(config: DockerSecurityProfileConfig = {}): string[] {
  const securityOptions = [DOCKER_NO_NEW_PRIVILEGES];
  const seccompProfile = normalizeProfileValue(
    config.seccompProfile,
    'RUNTIME_SECCOMP_PROFILE',
    SECCOMP_PROFILE_PATTERN,
  );
  const appArmorProfile = normalizeProfileValue(
    config.appArmorProfile,
    'RUNTIME_APPARMOR_PROFILE',
    APPARMOR_PROFILE_PATTERN,
  );

  if (seccompProfile) securityOptions.push(`seccomp=${seccompProfile}`);
  if (appArmorProfile) securityOptions.push(`apparmor=${appArmorProfile}`);
  return securityOptions;
}
