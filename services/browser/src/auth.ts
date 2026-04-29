import {
  validateSessionUserId,
  verifyUserExists as verifySharedUserExists,
} from '@pcp/db/src/session';

/**
 * Validate a session cookie against the shared sessions table. Returns the userId
 * or null when the session is missing/expired/unknown.
 */
export async function validateSessionCookie(sessionId: string): Promise<string | null> {
  if (!sessionId) return null;
  return validateSessionUserId(sessionId);
}

/**
 * Confirm that a user id received via internal Bearer + x-user-id header maps
 * to a real account.
 */
export async function verifyUserExists(userId: string): Promise<string | null> {
  if (!userId) return null;
  return verifySharedUserExists(userId);
}
