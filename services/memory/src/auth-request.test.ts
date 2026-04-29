import { beforeEach, describe, expect, it, vi } from 'vitest';

const sessionHelpers = vi.hoisted(() => ({
  validateSessionUserId: vi.fn(),
  verifyUserExists: vi.fn(),
  getSessionUserContext: vi.fn(),
}));

vi.mock('@pcp/db/src/session', () => sessionHelpers);

import { resolveAuthenticatedUserId } from '@pcp/db/src/auth-request';

function makeRequest(overrides: {
  headers?: Record<string, string | string[] | undefined>;
  sessionId?: string;
}) {
  return {
    headers: overrides.headers ?? {},
    cookies: { sessionId: overrides.sessionId },
  };
}

describe('resolveAuthenticatedUserId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when neither cookie nor internal token is present', async () => {
    const result = await resolveAuthenticatedUserId(makeRequest({}));
    expect(result).toBeNull();
    expect(sessionHelpers.validateSessionUserId).not.toHaveBeenCalled();
    expect(sessionHelpers.verifyUserExists).not.toHaveBeenCalled();
  });

  it('uses cookie session when no internal token configured', async () => {
    sessionHelpers.validateSessionUserId.mockResolvedValue('user-1');

    const result = await resolveAuthenticatedUserId(makeRequest({ sessionId: 'sess' }));

    expect(result).toBe('user-1');
    expect(sessionHelpers.validateSessionUserId).toHaveBeenCalledWith('sess');
    expect(sessionHelpers.verifyUserExists).not.toHaveBeenCalled();
  });

  it('verifies x-user-id when bearer token matches internal token', async () => {
    sessionHelpers.verifyUserExists.mockResolvedValue('user-2');

    const result = await resolveAuthenticatedUserId(
      makeRequest({
        headers: {
          authorization: 'Bearer secret-token',
          'x-user-id': 'user-2',
        },
      }),
      { internalServiceToken: 'secret-token' },
    );

    expect(result).toBe('user-2');
    expect(sessionHelpers.verifyUserExists).toHaveBeenCalledWith('user-2');
    expect(sessionHelpers.validateSessionUserId).not.toHaveBeenCalled();
  });

  it('falls back to cookie when bearer token is wrong', async () => {
    sessionHelpers.validateSessionUserId.mockResolvedValue('user-3');

    const result = await resolveAuthenticatedUserId(
      makeRequest({
        headers: { authorization: 'Bearer wrong', 'x-user-id': 'user-2' },
        sessionId: 'sess',
      }),
      { internalServiceToken: 'secret-token' },
    );

    expect(result).toBe('user-3');
    expect(sessionHelpers.verifyUserExists).not.toHaveBeenCalled();
    expect(sessionHelpers.validateSessionUserId).toHaveBeenCalledWith('sess');
  });

  it('does not honor x-user-id without a bearer token', async () => {
    const result = await resolveAuthenticatedUserId(
      makeRequest({ headers: { 'x-user-id': 'user-2' } }),
      { internalServiceToken: 'secret-token' },
    );

    expect(result).toBeNull();
    expect(sessionHelpers.verifyUserExists).not.toHaveBeenCalled();
  });

  it('does not honor bearer token when internalServiceToken is unset', async () => {
    sessionHelpers.validateSessionUserId.mockResolvedValue(null);

    const result = await resolveAuthenticatedUserId(
      makeRequest({
        headers: { authorization: 'Bearer secret-token', 'x-user-id': 'user-2' },
        sessionId: 'sess',
      }),
    );

    expect(result).toBeNull();
    expect(sessionHelpers.verifyUserExists).not.toHaveBeenCalled();
    expect(sessionHelpers.validateSessionUserId).toHaveBeenCalledWith('sess');
  });

  it('rejects bearer when x-user-id header is missing', async () => {
    sessionHelpers.validateSessionUserId.mockResolvedValue('user-cookie');

    const result = await resolveAuthenticatedUserId(
      makeRequest({
        headers: { authorization: 'Bearer secret-token' },
        sessionId: 'sess',
      }),
      { internalServiceToken: 'secret-token' },
    );

    expect(result).toBe('user-cookie');
    expect(sessionHelpers.verifyUserExists).not.toHaveBeenCalled();
  });

  it('rejects bearer with a different-length token (timing-safe path)', async () => {
    sessionHelpers.validateSessionUserId.mockResolvedValue(null);

    const result = await resolveAuthenticatedUserId(
      makeRequest({
        headers: { authorization: 'Bearer short', 'x-user-id': 'user-2' },
      }),
      { internalServiceToken: 'a-much-longer-secret-token-value' },
    );

    expect(result).toBeNull();
    expect(sessionHelpers.verifyUserExists).not.toHaveBeenCalled();
  });
});
