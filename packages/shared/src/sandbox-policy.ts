export type SandboxProfile = 'strict' | 'balanced' | 'permissive';

export type SandboxCommandRule = {
  readonly category: string;
  readonly description: string;
  readonly pattern: RegExp;
  readonly profiles: readonly SandboxProfile[];
};

const SANDBOX_PROFILES: readonly SandboxProfile[] = ['strict', 'balanced', 'permissive'];

const SANDBOX_COMMAND_RULES: readonly SandboxCommandRule[] = [
  {
    category: 'destructive root deletion',
    description: 'Blocks attempts to recursively delete filesystem roots.',
    pattern: /rm\s+-rf\s+\//,
    profiles: ['strict', 'balanced', 'permissive'],
  },
  {
    category: 'privilege escalation',
    description: 'Blocks sudo/su privilege escalation attempts.',
    pattern: /(?:^|\s)(?:sudo|su)\b/,
    profiles: ['strict', 'balanced', 'permissive'],
  },
  {
    category: 'fork bomb',
    description: 'Blocks shell fork bomb patterns.',
    pattern: /:\(\)\{\s*:\|:&\s*\};:/,
    profiles: ['strict', 'balanced', 'permissive'],
  },
  {
    category: 'network fetcher',
    description: 'Blocks ad-hoc outbound fetch tools in stricter profiles.',
    pattern: /(?:^|\s)(?:curl|wget|nc|netcat|ssh|scp|ftp|telnet)\b/,
    profiles: ['strict', 'balanced'],
  },
  {
    category: 'package install',
    description: 'Blocks dependency installation in strict profile.',
    pattern: /(?:^|\s)(?:npm|pnpm|yarn|bun|pip|pip3|apt|apk|brew)\s+(?:install|add|i)\b/,
    profiles: ['strict'],
  },
] as const;

const MAX_COMMAND_ARGS = 64;
const MAX_COMMAND_ARG_LENGTH = 4096;
export const DEFAULT_SANDBOX_PROFILE: SandboxProfile = 'balanced';

export const SANDBOX_COMMAND_POLICY = {
  defaultProfile: DEFAULT_SANDBOX_PROFILE,
  profiles: SANDBOX_PROFILES,
  timeoutMs: 60_000,
  network: 'disabled',
  blockedCategories: getBlockedSandboxCommandCategories(DEFAULT_SANDBOX_PROFILE),
} as const;

export function normalizeSandboxProfile(profile: string | undefined): SandboxProfile {
  if (profile === 'strict' || profile === 'permissive') return profile;
  return DEFAULT_SANDBOX_PROFILE;
}

export function getSandboxCommandRules(profile: SandboxProfile): readonly SandboxCommandRule[] {
  return SANDBOX_COMMAND_RULES.filter((rule) => rule.profiles.includes(profile));
}

export function getBlockedSandboxCommandCategories(profile: SandboxProfile): readonly string[] {
  return getSandboxCommandRules(profile).map((rule) => rule.category);
}

export function assertSandboxCommandAllowed(command: readonly string[], profile: SandboxProfile): void {
  if (command.length === 0 || command.length > MAX_COMMAND_ARGS) {
    throw new Error('Command blocked by security policy');
  }

  if (command.some((arg) => arg.length === 0 || arg.length > MAX_COMMAND_ARG_LENGTH || /\0/.test(arg))) {
    throw new Error('Command blocked by security policy');
  }

  const commandStr = command.join(' ');
  if (getSandboxCommandRules(profile).some((rule) => rule.pattern.test(commandStr))) {
    throw new Error('Command blocked by security policy');
  }
}
