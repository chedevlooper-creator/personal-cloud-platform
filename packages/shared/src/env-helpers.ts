/**
 * Shared environment-variable validation helpers.
 *
 * Every service follows the same pattern: parse a Zod schema, then post-process
 * specific fields with development-friendly fallbacks while refusing unsafe
 * defaults when NODE_ENV=production. These helpers ensure the production guard
 * cannot drift between services.
 */

export const UNSAFE_VALUE_TOKENS = ['change_me', 'replace', 'dummy'] as const;

export function isUnsafeEnvValue(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    UNSAFE_VALUE_TOKENS.some((token) => lower.includes(token)) ||
    lower.startsWith('dev-') ||
    lower === '0123456789abcdef'.repeat(2)
  );
}

export function makeDevelopmentSecret(length: number, name: string): string {
  const seed = `dev-${name.toLowerCase().replace(/_/g, '-')}-`;
  return seed.repeat(Math.ceil(length / seed.length)).slice(0, length);
}

export function makeDevelopmentValue(name: string): string {
  return `dev-${name.toLowerCase().replace(/_/g, '-')}`;
}

export interface EnvResolverContext {
  isProduction: boolean;
}

/**
 * Resolves a secret with a length-bounded development fallback.
 * In production, refuses any unsafe placeholder value.
 */
export function resolveSecret(
  ctx: EnvResolverContext,
  name: string,
  value: string | undefined,
  minLength: number,
): string {
  const resolved = value?.trim() || makeDevelopmentSecret(minLength, name);
  if (resolved.length < minLength) {
    throw new Error(`${name} must be at least ${minLength} characters long`);
  }
  if (ctx.isProduction && isUnsafeEnvValue(resolved)) {
    throw new Error(`${name} must be set to a non-default value in production`);
  }
  return resolved;
}

/**
 * Resolves a value that is required (and must be non-default) in production.
 * In development the value can be empty; an optional fallback is honored.
 */
export function resolveProductionValue(
  ctx: EnvResolverContext,
  name: string,
  value: string | undefined,
  fallback?: string,
): string {
  const resolved = value?.trim() || fallback || '';
  if (ctx.isProduction && (!resolved || isUnsafeEnvValue(resolved))) {
    throw new Error(`${name} must be set to a non-default value in production`);
  }
  return resolved;
}

/**
 * Resolves an external API/provider value with a deterministic dev fallback.
 * In production refuses unsafe defaults but allows missing values to surface
 * elsewhere (e.g. provider feature gates).
 */
export function resolveExternalValue(
  ctx: EnvResolverContext,
  name: string,
  value: string | undefined,
): string {
  const resolved = value?.trim() || makeDevelopmentValue(name);
  if (ctx.isProduction && isUnsafeEnvValue(resolved)) {
    throw new Error(`${name} must be set to a non-default value in production`);
  }
  return resolved;
}

/**
 * Validates that a 32-byte ENCRYPTION_KEY-style secret is well-formed.
 * Caller is responsible for providing the development fallback if desired.
 */
export function assertEncryptionKey(name: string, value: string, ctx: EnvResolverContext): void {
  if (Buffer.byteLength(value, 'utf8') !== 32) {
    throw new Error(`${name} must be exactly 32 bytes long`);
  }
  if (ctx.isProduction && isUnsafeEnvValue(value)) {
    throw new Error(`${name} must be set to a non-default value in production`);
  }
}
