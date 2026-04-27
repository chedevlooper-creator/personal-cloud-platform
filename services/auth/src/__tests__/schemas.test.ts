import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  createWorkspaceSchema,
  moveFileSchema,
  createAutomationSchema,
  createHostedServiceSchema,
  createSnapshotSchema,
  createProviderCredentialSchema,
  updateUserPreferencesSchema,
} from '@pcp/shared';

describe('Zod Schema Validation', () => {
  describe('Auth schemas', () => {
    it('should validate valid registration', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'Test User',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = registerSchema.safeParse({
        email: 'not-an-email',
        password: 'SecurePass123!',
      });
      expect(result.success).toBe(false);
    });

    it('should validate login schema', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'pass123',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Workspace schemas', () => {
    it('should validate workspace creation', () => {
      const result = createWorkspaceSchema.safeParse({
        name: 'My Workspace',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty workspace name', () => {
      const result = createWorkspaceSchema.safeParse({
        name: '',
      });
      expect(result.success).toBe(false);
    });

    it('should validate move file schema', () => {
      const result = moveFileSchema.safeParse({
        sourcePath: '/src/old.ts',
        destinationPath: '/src/new.ts',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Automation schemas', () => {
    it('should validate automation creation', () => {
      const result = createAutomationSchema.safeParse({
        workspaceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Daily Report',
        prompt: 'Generate a daily summary',
        scheduleType: 'daily',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing prompt', () => {
      const result = createAutomationSchema.safeParse({
        workspaceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        scheduleType: 'manual',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Hosting schemas', () => {
    it('should validate hosted service creation', () => {
      const result = createHostedServiceSchema.safeParse({
        workspaceId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'My Site',
        slug: 'my-site',
        kind: 'static',
        rootPath: '/',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Snapshot schemas', () => {
    it('should validate snapshot creation', () => {
      const result = createSnapshotSchema.safeParse({
        workspaceId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Before refactor',
        description: 'Saving state before big changes',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Settings schemas', () => {
    it('should validate provider credential creation', () => {
      const result = createProviderCredentialSchema.safeParse({
        provider: 'openai',
        key: 'sk-1234567890abcdef',
        label: 'My OpenAI Key',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty key', () => {
      const result = createProviderCredentialSchema.safeParse({
        provider: 'openai',
        key: '',
      });
      expect(result.success).toBe(false);
    });

    it('should validate preferences update', () => {
      const result = updateUserPreferencesSchema.safeParse({
        theme: 'dark',
        terminalRiskLevel: 'strict',
      });
      expect(result.success).toBe(true);
    });
  });
});
