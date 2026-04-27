import { db } from '@pcp/db/src/client';
import { users, sessions, oauthAccounts, auditLogs } from '@pcp/db/src/schema';
import { eq, and } from 'drizzle-orm';
import * as argon2 from 'argon2';
import crypto from 'crypto';

export type SanitizedUser = {
  id: string;
  email: string;
  name: string | null;
};

type AuditDetails = Record<string, unknown> | null;
type UserRecord = typeof users.$inferSelect;

export class AuthService {
  constructor(
    private logger: {
      info: (obj: object, msg?: string) => void;
      error: (obj: object, msg?: string) => void;
    },
  ) {}

  private async logAudit(
    action: string,
    userId: string | null,
    details: AuditDetails,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      await db.insert(auditLogs).values({
        action,
        userId,
        details,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      });
    } catch (error) {
      this.logger.error({ error, action, userId }, 'Failed to write audit log');
    }
  }

  async register(
    email: string,
    password: string,
    name?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    this.logger.info({}, 'Registering new user');
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      throw new Error('Email already registered');
    }

    const passwordHash = await argon2.hash(password);

    const [newUser] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name: name || null,
      })
      .returning();

    if (!newUser) {
      throw new Error('Failed to create user');
    }

    const session = await this.createSession(newUser.id);
    await this.logAudit('auth.register', newUser.id, null, ipAddress, userAgent);
    return { user: this.sanitizeUser(newUser), session };
  }

  async login(email: string, password: string, ipAddress?: string, userAgent?: string) {
    this.logger.info({}, 'User login attempt');
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user || !user.passwordHash) {
      await this.logAudit(
        'auth.login_failed',
        user?.id || null,
        { reason: 'Invalid credentials' },
        ipAddress,
        userAgent,
      );
      throw new Error('Invalid credentials');
    }

    const isValid = await argon2.verify(user.passwordHash, password);
    if (!isValid) {
      await this.logAudit(
        'auth.login_failed',
        user.id,
        { reason: 'Invalid credentials' },
        ipAddress,
        userAgent,
      );
      throw new Error('Invalid credentials');
    }

    const session = await this.createSession(user.id);
    await this.logAudit('auth.login', user.id, null, ipAddress, userAgent);
    return { user: this.sanitizeUser(user), session };
  }

  async handleOAuthLogin(
    data: {
      providerId: string;
      providerUserId: string;
      email: string;
      name: string;
      accessToken: string;
      refreshToken?: string;
    },
    ipAddress?: string,
    userAgent?: string,
  ) {
    let user = await db.query.users.findFirst({
      where: eq(users.email, data.email),
    });

    if (!user) {
      const [newUser] = await db
        .insert(users)
        .values({
          email: data.email,
          name: data.name,
        })
        .returning();
      if (!newUser) throw new Error('Failed to create user');
      user = newUser;
      await this.logAudit(
        'auth.register_oauth',
        user.id,
        { provider: data.providerId },
        ipAddress,
        userAgent,
      );
    }

    if (!user) throw new Error('User not found');

    const existingOauth = await db.query.oauthAccounts.findFirst({
      where: and(
        eq(oauthAccounts.providerId, data.providerId),
        eq(oauthAccounts.providerUserId, data.providerUserId),
      ),
    });

    if (existingOauth) {
      await db
        .update(oauthAccounts)
        .set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken || existingOauth.refreshToken,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(oauthAccounts.providerId, data.providerId),
            eq(oauthAccounts.providerUserId, data.providerUserId),
          ),
        );
    } else {
      await db.insert(oauthAccounts).values({
        providerId: data.providerId,
        providerUserId: data.providerUserId,
        userId: user.id,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
    }

    const session = await this.createSession(user.id);
    await this.logAudit(
      'auth.login_oauth',
      user.id,
      { provider: data.providerId },
      ipAddress,
      userAgent,
    );

    return { user: this.sanitizeUser(user), session };
  }

  async validateSession(sessionId: string) {
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session) return null;

    if (session.expiresAt.getTime() < Date.now()) {
      await this.logout(sessionId);
      return null;
    }

    // Refresh session expiration time if less than 15 days left
    const fifteenDays = 1000 * 60 * 60 * 24 * 15;
    if (session.expiresAt.getTime() - Date.now() < fifteenDays) {
      const newExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
      await db.update(sessions).set({ expiresAt: newExpiresAt }).where(eq(sessions.id, sessionId));
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    });

    return user ? this.sanitizeUser(user) : null;
  }

  private sanitizeUser(user: UserRecord): SanitizedUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }

  async refreshSession(oldSessionId: string, ipAddress?: string, userAgent?: string) {
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, oldSessionId),
    });

    if (!session || session.expiresAt.getTime() < Date.now()) {
      if (session) await this.logout(oldSessionId);
      return null;
    }

    const newSession = await this.createSession(session.userId);
    await this.logout(oldSessionId);
    await this.logAudit('auth.session_refresh', session.userId, null, ipAddress, userAgent);

    return newSession;
  }

  async logout(sessionId: string, ipAddress?: string, userAgent?: string) {
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (session) {
      await this.logAudit('auth.logout', session.userId, null, ipAddress, userAgent);
      await db.delete(sessions).where(eq(sessions.id, sessionId));
    }
  }

  private async createSession(userId: string) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

    const [session] = await db
      .insert(sessions)
      .values({
        id: sessionId,
        userId,
        expiresAt,
      })
      .returning();

    if (!session) {
      throw new Error('Failed to create session');
    }

    return session;
  }
}
