import { db } from '@pcp/db/src/client';
import { sessions, users } from '@pcp/db/src/schema';
import { eq } from 'drizzle-orm';

/**
 * Validate a session cookie against the shared sessions table. Returns the userId
 * or null when the session is missing/expired/unknown.
 */
export async function validateSessionCookie(sessionId: string): Promise<string | null> {
  if (!sessionId) return null;
  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  return user?.id ?? null;
}
