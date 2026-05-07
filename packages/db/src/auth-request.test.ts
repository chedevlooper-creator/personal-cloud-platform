import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveAuthenticatedUserId } from './auth-request';
import * as session from './session';

vi.mock('./session', () => ({
  validateSessionUserId: vi.fn(),
  verifyUserExists: vi.fn(),
  upsertExternalAuthUser: vi.fn(),
}));

describe('resolveAuthenticatedUserId audience scoping', () => {
  const TOKEN = 'super-secret-token';
  const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('resolves user when audience is in allowed list', async () => {
    vi.mocked(session.verifyUserExists).mockResolvedValue(USER_ID);

    const result = await resolveAuthenticatedUserId(
      {
        headers: {
          authorization: `Bearer ${TOKEN}`,
          'x-user-id': USER_ID,
          'x-service-audience': 'agent',
        },
        cookies: {},
      },
      { internalServiceToken: TOKEN, allowedAudiences: ['agent', 'runtime'] },
    );

    expect(result).toBe(USER_ID);
    expect(session.verifyUserExists).toHaveBeenCalledWith(USER_ID);
  });

  it('returns null when audience is not in allowed list', async () => {
    const result = await resolveAuthenticatedUserId(
      {
        headers: {
          authorization: `Bearer ${TOKEN}`,
          'x-user-id': USER_ID,
          'x-service-audience': 'untrusted-service',
        },
        cookies: {},
      },
      { internalServiceToken: TOKEN, allowedAudiences: ['agent', 'runtime'] },
    );

    expect(result).toBeNull();
    expect(session.verifyUserExists).not.toHaveBeenCalled();
  });

  it('returns null when audience header is missing and allowedAudiences is set', async () => {
    const result = await resolveAuthenticatedUserId(
      {
        headers: {
          authorization: `Bearer ${TOKEN}`,
          'x-user-id': USER_ID,
        },
        cookies: {},
      },
      { internalServiceToken: TOKEN, allowedAudiences: ['agent'] },
    );

    expect(result).toBeNull();
    expect(session.verifyUserExists).not.toHaveBeenCalled();
  });

  it('resolves user when allowedAudiences is unset (backward compat)', async () => {
    vi.mocked(session.verifyUserExists).mockResolvedValue(USER_ID);

    const result = await resolveAuthenticatedUserId(
      {
        headers: {
          authorization: `Bearer ${TOKEN}`,
          'x-user-id': USER_ID,
        },
        cookies: {},
      },
      { internalServiceToken: TOKEN },
    );

    expect(result).toBe(USER_ID);
  });

  it('resolves user when allowedAudiences is empty (backward compat)', async () => {
    vi.mocked(session.verifyUserExists).mockResolvedValue(USER_ID);

    const result = await resolveAuthenticatedUserId(
      {
        headers: {
          authorization: `Bearer ${TOKEN}`,
          'x-user-id': USER_ID,
          'x-service-audience': 'anything',
        },
        cookies: {},
      },
      { internalServiceToken: TOKEN, allowedAudiences: [] },
    );

    expect(result).toBe(USER_ID);
  });

  it('falls through to cookie auth when internal token is invalid', async () => {
    vi.mocked(session.validateSessionUserId).mockResolvedValue(USER_ID);

    const result = await resolveAuthenticatedUserId(
      {
        headers: {},
        cookies: { sessionId: 'valid-session' },
      },
      { internalServiceToken: TOKEN, allowedAudiences: ['agent'] },
    );

    expect(result).toBe(USER_ID);
  });
});
