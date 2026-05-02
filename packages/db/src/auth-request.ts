import { timingSafeEqual } from 'node:crypto';
import { upsertExternalAuthUser, validateSessionUserId, verifyUserExists } from './session';

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
  /** Development bypass: return this user id immediately without checking credentials. */
  authBypass?: boolean;
  /** User id returned when authBypass is true. Defaults to 'local-dev-user'. */
  bypassUserId?: string;
  /** Optional Supabase Auth validation for bearer/JWT cookie sessions. */
  supabaseAuth?: SupabaseAuthConfig;
}

export interface SupabaseAuthConfig {
  url: string;
  anonKey: string;
  fetchImpl?: typeof fetch;
}

interface SupabaseUserResponse {
  id?: string;
  email?: string;
  user_metadata?: {
    name?: string;
    full_name?: string;
  };
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
  if (options.authBypass) {
    return options.bypassUserId ?? 'local-dev-user';
  }

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

  const supabaseAuth = options.supabaseAuth ?? readSupabaseAuthConfig();
  const bearerToken = readBearerToken(request.headers);
  if (bearerToken && supabaseAuth) {
    const userId = await resolveSupabaseUserId(bearerToken, supabaseAuth);
    if (userId) return userId;
  }

  const sessionId = request.cookies?.sessionId;
  if (sessionId && supabaseAuth && isJwtLike(sessionId)) {
    const userId = await resolveSupabaseUserId(sessionId, supabaseAuth);
    return userId;
  }

  if (!sessionId) return null;
  return validateSessionUserId(sessionId);
}

function readBearerToken(headers: Record<string, string | string[] | undefined>): string | null {
  const auth = readHeader(headers, 'authorization');
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice('Bearer '.length).trim();
  return token || null;
}

function isJwtLike(value: string): boolean {
  return value.split('.').length === 3;
}

function readSupabaseAuthConfig(): SupabaseAuthConfig | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

async function resolveSupabaseUserId(
  accessToken: string,
  config: SupabaseAuthConfig,
): Promise<string | null> {
  const baseUrl = config.url.replace(/\/+$/, '');
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(`${baseUrl}/auth/v1/user`, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) return null;

  const body = (await response.json().catch(() => null)) as SupabaseUserResponse | null;
  if (!body?.id || !body.email) return null;

  return upsertExternalAuthUser({
    id: body.id,
    email: body.email,
    name: body.user_metadata?.name ?? body.user_metadata?.full_name ?? null,
  });
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
