export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

type AuthPayload = {
  email: string;
  password: string;
  name?: string;
};

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

type SupabaseUser = {
  id: string;
  email?: string;
  user_metadata?: {
    name?: string;
    full_name?: string;
  };
};

type SupabaseAuthResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  user?: SupabaseUser;
};

type StoredSession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  user: AuthUser;
};

type ClientOptions = {
  url: string;
  anonKey: string;
  fetchImpl?: typeof fetch;
  storage?: StorageLike;
  writeCookie?: (value: string) => void;
  clearCookie?: () => void;
};

const SESSION_STORAGE_KEY = 'pcp.supabase.session';

export function isSupabaseAuthConfigured(
  env: Record<string, string | undefined> = getPublicSupabaseEnv(),
): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function createSupabaseAuthClient(options: ClientOptions) {
  const baseUrl = options.url.replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;
  const storage = options.storage ?? browserStorage();
  const writeCookie = options.writeCookie ?? writeBrowserSessionCookie;
  const clearCookie = options.clearCookie ?? clearBrowserSessionCookie;

  async function request(path: string, init: RequestInit = {}) {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: {
        apikey: options.anonKey,
        Authorization: `Bearer ${options.anonKey}`,
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        typeof body?.msg === 'string'
          ? body.msg
          : typeof body?.message === 'string'
            ? body.message
            : 'Supabase Auth request failed';
      throw new Error(message);
    }

    return body as SupabaseAuthResponse;
  }

  function storeSession(response: SupabaseAuthResponse): AuthUser {
    if (!response.user) {
      throw new Error('Supabase Auth did not return a user');
    }

    const user = toAuthUser(response.user);
    if (!response.access_token) {
      throw new Error('Confirm your email before signing in.');
    }

    const expiresIn = response.expires_in ?? 3600;
    const session: StoredSession = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresAt: Date.now() + expiresIn * 1000,
      user,
    };
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    writeCookie(`sessionId=${response.access_token}; path=/; max-age=${expiresIn}; samesite=lax`);

    return user;
  }

  return {
    async register(payload: AuthPayload): Promise<AuthUser> {
      return storeSession(
        await request('/auth/v1/signup', {
          method: 'POST',
          body: JSON.stringify({
            email: payload.email,
            password: payload.password,
            data: payload.name ? { name: payload.name } : undefined,
          }),
        }),
      );
    },

    async login(payload: Omit<AuthPayload, 'name'>): Promise<AuthUser> {
      return storeSession(
        await request('/auth/v1/token?grant_type=password', {
          method: 'POST',
          body: JSON.stringify({
            email: payload.email,
            password: payload.password,
          }),
        }),
      );
    },

    async getCurrentUser(): Promise<AuthUser | null> {
      const session = readStoredSession(storage);
      if (!session) return null;

      if (session.expiresAt && session.expiresAt <= Date.now()) {
        clearCookie();
        storage.removeItem(SESSION_STORAGE_KEY);
        return null;
      }

      return session.user;
    },

    async logout(): Promise<void> {
      const session = readStoredSession(storage);
      storage.removeItem(SESSION_STORAGE_KEY);
      clearCookie();

      if (!session) return;
      await request('/auth/v1/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      }).catch(() => undefined);
    },
  };
}

const publicSupabaseEnv = getPublicSupabaseEnv();

export const supabaseAuth = isSupabaseAuthConfigured(publicSupabaseEnv)
  ? createSupabaseAuthClient({
      url: publicSupabaseEnv.NEXT_PUBLIC_SUPABASE_URL as string,
      anonKey: publicSupabaseEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    })
  : null;

function getPublicSupabaseEnv(): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

function toAuthUser(user: SupabaseUser): AuthUser {
  return {
    id: user.id,
    email: user.email ?? '',
    name: user.user_metadata?.name ?? user.user_metadata?.full_name ?? null,
  };
}

function readStoredSession(storage: StorageLike): StoredSession | null {
  const value = storage.getItem(SESSION_STORAGE_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as StoredSession;
  } catch {
    storage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

function browserStorage(): StorageLike {
  if (typeof window === 'undefined') {
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
  }

  return window.localStorage;
}

function writeBrowserSessionCookie(value: string): void {
  if (typeof document !== 'undefined') {
    document.cookie = value;
  }
}

function clearBrowserSessionCookie(): void {
  if (typeof document !== 'undefined') {
    document.cookie = 'sessionId=; path=/; max-age=0; samesite=lax';
  }
}
