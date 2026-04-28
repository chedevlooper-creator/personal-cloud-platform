import { eq } from 'drizzle-orm';
import { db } from './client';
import { sessions, users } from './schema';

export interface SessionUserContext {
  sessionId: string;
  userId: string;
  expiresAt: Date;
}

export async function getSessionUserContext(
  sessionId: string | null | undefined,
): Promise<SessionUserContext | null> {
  if (!sessionId) return null;

  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });

  if (!session || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });

  if (!user) return null;

  return {
    sessionId: session.id,
    userId: user.id,
    expiresAt: session.expiresAt,
  };
}

export async function validateSessionUserId(
  sessionId: string | null | undefined,
): Promise<string | null> {
  const context = await getSessionUserContext(sessionId);
  return context?.userId ?? null;
}

export async function verifyUserExists(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  return user?.id ?? null;
}
