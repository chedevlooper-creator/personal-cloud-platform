export const RUNTIME_IMAGE_ALLOWLIST = ['node:20-alpine'] as const;

type DockerSecurityProfileConfig = {
  seccompProfile?: string;
  appArmorProfile?: string;
};

const DOCKER_NO_NEW_PRIVILEGES = 'no-new-privileges:true';
const SECCOMP_PROFILE_PATTERN = /^\/?[A-Za-z0-9][A-Za-z0-9_./:-]*$/;
const APPARMOR_PROFILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;

const BLOCKED_COMMANDS = [
  {
    category: 'destructive root deletion',
    pattern: /rm\s+-rf\s+\//,
  },
  {
    category: 'privilege escalation',
    pattern: /(?:^|\s)sudo\b/,
  },
  {
    category: 'fork bomb',
    pattern: /:\(\)\{\s*:\|:&\s*\};:/,
  },
] as const;

export const RUNTIME_COMMAND_POLICY = {
  timeoutMs: 60_000,
  network: 'disabled',
  blockedCategories: BLOCKED_COMMANDS.map((rule) => rule.category),
} as const;

export function assertRuntimeImageAllowed(image: string): void {
  if (!RUNTIME_IMAGE_ALLOWLIST.includes(image as (typeof RUNTIME_IMAGE_ALLOWLIST)[number])) {
    throw new Error('Runtime image is not allowed');
  }
}

export function assertRuntimeCommandAllowed(command: string[]): void {
  const commandStr = command.join(' ');
  if (BLOCKED_COMMANDS.some((rule) => rule.pattern.test(commandStr))) {
    throw new Error('Command blocked by security policy');
  }
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

function normalizeProfileValue(
  value: string | undefined,
  envName: string,
  pattern: RegExp,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed === 'unconfined') {
    throw new Error(`${envName} must not disable confinement`);
  }
  if (trimmed.includes('..') || !pattern.test(trimmed)) {
    throw new Error(`${envName} contains invalid characters`);
  }
  return trimmed;
}
