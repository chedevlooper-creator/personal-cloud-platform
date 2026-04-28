import { beforeEach, describe, expect, it, vi } from 'vitest';

const sessionHelpers = vi.hoisted(() => ({
  validateSessionUserId: vi.fn(),
  verifyUserExists: vi.fn(),
}));

const dbMock = vi.hoisted(() => ({
  db: {
    query: {
      sessions: { findFirst: vi.fn() },
      users: { findFirst: vi.fn() },
    },
  },
}));

vi.mock('@pcp/db/src/session', () => sessionHelpers);
vi.mock('@pcp/db/src/client', () => dbMock);
vi.mock('@pcp/db/src/schema', () => ({
  sessions: { id: 'sessions.id' },
  users: { id: 'users.id' },
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }));

import { validateSessionCookie, verifyUserExists } from './auth';

describe('browser auth helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates cookie session validation to the shared session helper', async () => {
    sessionHelpers.validateSessionUserId.mockResolvedValue('user-1');

    await expect(validateSessionCookie('session-1')).resolves.toBe('user-1');

    expect(sessionHelpers.validateSessionUserId).toHaveBeenCalledWith('session-1');
    expect(dbMock.db.query.sessions.findFirst).not.toHaveBeenCalled();
  });

  it('fails closed without touching storage when the session id is missing', async () => {
    await expect(validateSessionCookie('')).resolves.toBeNull();

    expect(sessionHelpers.validateSessionUserId).not.toHaveBeenCalled();
    expect(dbMock.db.query.sessions.findFirst).not.toHaveBeenCalled();
  });

  it('delegates internal user verification to the shared user helper', async () => {
    sessionHelpers.verifyUserExists.mockResolvedValue('user-1');

    await expect(verifyUserExists('user-1')).resolves.toBe('user-1');

    expect(sessionHelpers.verifyUserExists).toHaveBeenCalledWith('user-1');
    expect(dbMock.db.query.users.findFirst).not.toHaveBeenCalled();
  });
});
