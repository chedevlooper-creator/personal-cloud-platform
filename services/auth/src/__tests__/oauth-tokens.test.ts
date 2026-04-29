import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../service';
import { decryptOAuthToken } from '../encryption';

const mocks = vi.hoisted(() => ({
  users: {
    id: 'users.id',
    email: 'users.email',
  },
  sessions: {
    id: 'sessions.id',
    userId: 'sessions.userId',
    expiresAt: 'sessions.expiresAt',
  },
  oauthAccounts: {
    providerId: 'oauthAccounts.providerId',
    providerUserId: 'oauthAccounts.providerUserId',
  },
  auditLogs: {},
  dbInsert: vi.fn(),
  dbUpdate: vi.fn(),
}));

vi.mock('@pcp/db/src/schema', () => ({
  users: mocks.users,
  sessions: mocks.sessions,
  oauthAccounts: mocks.oauthAccounts,
  auditLogs: mocks.auditLogs,
}));
vi.mock('@pcp/db/src/client', () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      oauthAccounts: { findFirst: vi.fn() },
    },
    insert: mocks.dbInsert,
    update: mocks.dbUpdate,
  },
}));

const { db } = await import('@pcp/db/src/client');
const mockDb = db as unknown as {
  query: {
    users: { findFirst: ReturnType<typeof vi.fn> };
    oauthAccounts: { findFirst: ReturnType<typeof vi.fn> };
  };
};

const logger = {
  info: vi.fn(),
  error: vi.fn(),
};

describe('AuthService OAuth token storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('encrypts access and refresh tokens for new OAuth accounts', async () => {
    const oauthInsertValues = vi.fn().mockResolvedValue(undefined);
    mockDb.query.users.findFirst.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
      name: 'User',
      passwordHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockDb.query.oauthAccounts.findFirst.mockResolvedValue(null);
    mocks.dbInsert.mockImplementation((table) => {
      if (table === mocks.sessions) {
        return {
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'session-id', userId: 'user-id' }]),
          }),
        };
      }
      if (table === mocks.oauthAccounts) {
        return { values: oauthInsertValues };
      }
      return { values: vi.fn().mockResolvedValue(undefined) };
    });

    await new AuthService(logger).handleOAuthLogin({
      providerId: 'google',
      providerUserId: 'google-user-id',
      email: 'user@example.com',
      name: 'User',
      accessToken: 'access-token-secret',
      refreshToken: 'refresh-token-secret',
    });

    expect(oauthInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: expect.stringMatching(/^enc:v1:/),
        refreshToken: expect.stringMatching(/^enc:v1:/),
      }),
    );
    const stored = oauthInsertValues.mock.calls[0]?.[0];
    expect(stored.accessToken).not.toBe('access-token-secret');
    expect(stored.refreshToken).not.toBe('refresh-token-secret');
    expect(decryptOAuthToken(stored.accessToken)).toBe('access-token-secret');
    expect(decryptOAuthToken(stored.refreshToken)).toBe('refresh-token-secret');
  });

  it('encrypts updated access token and preserves existing refresh token when not returned', async () => {
    const updateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDb.query.users.findFirst.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
      name: 'User',
      passwordHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockDb.query.oauthAccounts.findFirst.mockResolvedValue({
      providerId: 'google',
      providerUserId: 'google-user-id',
      userId: '550e8400-e29b-41d4-a716-446655440000',
      accessToken: 'old-access-token',
      refreshToken: 'existing-refresh-token',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mocks.dbUpdate.mockReturnValue({ set: updateSet });
    mocks.dbInsert.mockImplementation((table) => {
      if (table === mocks.sessions) {
        return {
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'session-id', userId: 'user-id' }]),
          }),
        };
      }
      return { values: vi.fn().mockResolvedValue(undefined) };
    });

    await new AuthService(logger).handleOAuthLogin({
      providerId: 'google',
      providerUserId: 'google-user-id',
      email: 'user@example.com',
      name: 'User',
      accessToken: 'new-access-token-secret',
    });

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: expect.stringMatching(/^enc:v1:/),
        refreshToken: 'existing-refresh-token',
      }),
    );
    const stored = updateSet.mock.calls[0]?.[0];
    expect(stored.accessToken).not.toBe('new-access-token-secret');
    expect(decryptOAuthToken(stored.accessToken)).toBe('new-access-token-secret');
  });
});
