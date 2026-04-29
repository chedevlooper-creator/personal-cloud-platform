export const RUNTIME_IMAGE_ALLOWLIST = ['node:20-alpine'] as const;

const BLOCKED_COMMANDS = [
  {
    category: 'destructive root deletion',
    pattern: /rm\s+-rf\s+\//,
  },
  {
    category: 'privilege escalation',
    pattern: /^sudo\b/,
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
