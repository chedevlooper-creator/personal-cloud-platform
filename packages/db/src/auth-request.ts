import { timingSafeEqual } from 'node:crypto';
import { validateSessionUserId, verifyUserExists } from './session';

/**
 * Minimal shape every Fastify request already exposes. We do not depend on
 * `fastify` here so this module stays usable from non-route contexts (tests,
 * websocket auth, BullMQ workers, ...).
 */
export interface AuthRequestLike {
  headers: Record<string, string | string[] | undefined>;
  cookies: { sessionId?: string };
}

export interface ResolveAuthOptions {
  /**
   * Optional shared secret expected on the `Authorization: Bearer <token>`
   * header for service-to-service calls. When unset, the internal-token path
   * is disabled and only the cookie session is honored.
   */
  internalServiceToken?: string;
}

function readHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Resolve the acting user id for an inbound request, in this priority:
 *
 * 1. `Authorization: Bearer <INTERNAL_SERVICE_TOKEN>` + `X-User-Id: <uuid>`
 *    — internal service-to-service path. The user id is verified against
 *    the users table to defend against forged headers.
 * 2. `Cookie: sessionId=<id>` — the standard browser session path. The
 *    session must exist and not be expired.
 *
 * Returns `null` when no path authenticates the request. Routes should
 * respond with `401` on `null`.
 */
export async function resolveAuthenticatedUserId(
  request: AuthRequestLike,
  options: ResolveAuthOptions = {},
): Promise<string | null> {
  const internalToken = options.internalServiceToken;
  if (internalToken) {
    const auth = readHeader(request.headers, 'authorization');
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      const token = auth.slice('Bearer '.length).trim();
      if (token && constantTimeEquals(token, internalToken)) {
        const headerUserId = readHeader(request.headers, 'x-user-id');
        if (typeof headerUserId === 'string' && headerUserId.length > 0) {
          return verifyUserExists(headerUserId);
        }
      }
    }
  }

  const sessionId = request.cookies?.sessionId;
  if (!sessionId) return null;
  return validateSessionUserId(sessionId);
}

/**
 * Constant-time string comparison to prevent timing-oracle attacks against
 * the internal service token. Strings of differing length are compared
 * against a fixed-length buffer so the early-exit path does not leak length.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) {
    // Still perform a comparison of equal-size buffers so the timing path
    // does not branch on length alone.
    timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}
