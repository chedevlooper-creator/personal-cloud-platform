import { describe, expect, it } from 'vitest';
import { isAdminUser } from '../routes/admin';
import { SanitizedUser } from '../service';

const user: SanitizedUser = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'admin@example.com',
  name: 'Admin',
};

describe('admin authorization policy', () => {
  it('fails closed when no admin email is configured', () => {
    expect(isAdminUser(user, undefined)).toBe(false);
  });

  it('allows only the configured admin email', () => {
    expect(isAdminUser(user, 'admin@example.com')).toBe(true);
    expect(isAdminUser(user, 'other@example.com')).toBe(false);
  });

  it('normalizes configured admin email case', () => {
    expect(isAdminUser(user, 'Admin@Example.com')).toBe(true);
  });
});
