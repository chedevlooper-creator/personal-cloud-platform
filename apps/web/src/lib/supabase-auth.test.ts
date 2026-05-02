import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSupabaseAuthClient, isSupabaseAuthConfigured } from './supabase-auth';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('supabase auth client', () => {
  it('detects whether public Supabase auth env is configured', () => {
    assert.equal(isSupabaseAuthConfigured({}), false);
    assert.equal(
      isSupabaseAuthConfigured({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      }),
      true,
    );
  });

  it('registers through Supabase Auth and stores the returned session', async () => {
    const storage = new MemoryStorage();
    const cookieWrites: string[] = [];
    const requests: Array<{ url: string; init: RequestInit }> = [];

    const client = createSupabaseAuthClient({
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
      storage,
      writeCookie: (value) => cookieWrites.push(value),
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init: init ?? {} });
        return new Response(
          JSON.stringify({
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: 3600,
            token_type: 'bearer',
            user: {
              id: 'user-id',
              email: 'isa@example.com',
              user_metadata: { name: 'Isa' },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    });

    const user = await client.register({
      email: 'isa@example.com',
      password: 'password-123',
      name: 'Isa',
    });

    assert.equal(user.id, 'user-id');
    assert.equal(user.email, 'isa@example.com');
    assert.equal(user.name, 'Isa');
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.url, 'https://example.supabase.co/auth/v1/signup');
    assert.equal((requests[0]?.init.headers as Record<string, string>).apikey, 'anon-key');
    assert.equal(
      (requests[0]?.init.headers as Record<string, string>).Authorization,
      'Bearer anon-key',
    );
    assert.deepEqual(JSON.parse(String(requests[0]?.init.body)), {
      email: 'isa@example.com',
      password: 'password-123',
      data: { name: 'Isa' },
    });
    assert.match(storage.getItem('pcp.supabase.session') ?? '', /access-token/);
    assert.equal(cookieWrites[0], 'sessionId=access-token; path=/; max-age=3600; samesite=lax');
  });

  it('does not treat email-confirmation signups as active sessions', async () => {
    const storage = new MemoryStorage();
    const cookieWrites: string[] = [];

    const client = createSupabaseAuthClient({
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
      storage,
      writeCookie: (value) => cookieWrites.push(value),
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            user: {
              id: 'user-id',
              email: 'isa@example.com',
              user_metadata: { name: 'Isa' },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    });

    await assert.rejects(
      client.register({
        email: 'isa@example.com',
        password: 'password-123',
        name: 'Isa',
      }),
      /Confirm your email before signing in/,
    );
    assert.equal(storage.getItem('pcp.supabase.session'), null);
    assert.equal(cookieWrites.length, 0);
  });
});
