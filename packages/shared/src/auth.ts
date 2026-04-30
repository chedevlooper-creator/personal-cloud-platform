import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2).optional(),
});

export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type LoginDto = z.infer<typeof loginSchema>;

export const authResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().nullable(),
  }),
});

export type AuthResponseDto = z.infer<typeof authResponseSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Shared auth middleware — eliminates duplicate session validation
// ────────────────────────────────────────────────────────────────────────────

export interface AuthOptions {
  authBypass?: boolean;
  bypassUserId?: string;
  /** Service-provided session validator. Injected to avoid @pcp/db dependency. */
  validateSession?: (sessionId: string) => Promise<string | null>;
}

/**
 * Resolve a userId from a session cookie.
 *
 * - If `authBypass` is enabled, returns `bypassUserId` (or a default dev user).
 * - If no sessionId is present, returns `null`.
 * - Otherwise delegates to the injected `validateSession` validator.
 */
export async function resolveUserIdFromSession(
  sessionId: string | undefined,
  options: AuthOptions = {},
): Promise<string | null> {
  if (options.authBypass) {
    return options.bypassUserId ?? 'local-dev-user';
  }
  if (!sessionId) return null;
  if (options.validateSession) {
    return options.validateSession(sessionId);
  }
  return null;
}

/**
 * Factory that creates a bound `getUserId` function for a service's routes.
 *
 * Usage:
 * ```ts
 * import { createAuthMiddleware } from '@pcp/shared';
 * import { validateSessionUserId } from '@pcp/db/src/session';
 *
 * const getUserId = createAuthMiddleware({
 *   authBypass: env.AUTH_BYPASS,
 *   validateSession: validateSessionUserId,
 * });
 * ```
 */
export function createAuthMiddleware(options: AuthOptions) {
  return async function getUserId(sessionId: string | undefined): Promise<string | null> {
    return resolveUserIdFromSession(sessionId, options);
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Internal service token validation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Verify an inbound `Authorization` bearer token against the expected
 * internal service token.
 */
export function verifyInternalServiceToken(
  authorizationHeader: string | undefined,
  expectedToken: string,
): boolean {
  if (!authorizationHeader || !expectedToken) return false;
  return authorizationHeader === `Bearer ${expectedToken}`;
}
