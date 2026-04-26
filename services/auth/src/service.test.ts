import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AuthService } from './service';
import { db } from '@pcp/db/src/client';
import { users } from '@pcp/db/src/schema';
import { eq } from 'drizzle-orm';
import pino from 'pino';

// Skipping because it requires a live test database (Docker is unavailable in the environment)
describe.skip('AuthService', () => {
  const logger = pino({ level: 'silent' });
  const authService = new AuthService(logger);

  const testEmail = 'test@example.com';
  const testPassword = 'securepassword123';

  beforeAll(async () => {
    // Clean up test data
    await db.delete(users).where(eq(users.email, testEmail));
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(users).where(eq(users.email, testEmail));
  });

  it('should register a new user', async () => {
    const { user, session } = await authService.register(testEmail, testPassword, 'Test User');
    
    expect(user.email).toBe(testEmail);
    expect(user.name).toBe('Test User');
    expect(user).not.toHaveProperty('passwordHash');
    
    expect(session.id).toBeDefined();
    expect(session.userId).toBe(user.id);
  });

  it('should fail to register with an existing email', async () => {
    await expect(authService.register(testEmail, testPassword))
      .rejects.toThrow('Email already registered');
  });

  it('should login with valid credentials', async () => {
    const { user, session } = await authService.login(testEmail, testPassword);
    
    expect(user.email).toBe(testEmail);
    expect(session.id).toBeDefined();
  });

  it('should fail to login with invalid credentials', async () => {
    await expect(authService.login(testEmail, 'wrongpassword'))
      .rejects.toThrow('Invalid credentials');
  });

  it('should validate a valid session', async () => {
    const { session } = await authService.login(testEmail, testPassword);
    
    const validUser = await authService.validateSession(session.id);
    expect(validUser).not.toBeNull();
    expect(validUser?.email).toBe(testEmail);
  });

  it('should return null for an invalid session', async () => {
    const validUser = await authService.validateSession('invalid-session-id');
    expect(validUser).toBeNull();
  });

  it('should logout and invalidate session', async () => {
    const { session } = await authService.login(testEmail, testPassword);
    
    await authService.logout(session.id);
    const validUser = await authService.validateSession(session.id);
    
    expect(validUser).toBeNull();
  });
});
