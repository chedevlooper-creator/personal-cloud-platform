import { describe, expect, it } from 'vitest';
import { googleUserInfoSchema } from './routes';

describe('googleUserInfoSchema', () => {
  it('accepts verified Google email identities', () => {
    expect(
      googleUserInfoSchema.parse({
        id: 'google-user-1',
        email: 'user@example.com',
        name: 'User Example',
        verified_email: true,
      }),
    ).toMatchObject({ email: 'user@example.com' });
  });

  it('rejects unverified Google email identities', () => {
    expect(() =>
      googleUserInfoSchema.parse({
        id: 'google-user-1',
        email: 'user@example.com',
        name: 'User Example',
        verified_email: false,
      }),
    ).toThrow();
  });
});
