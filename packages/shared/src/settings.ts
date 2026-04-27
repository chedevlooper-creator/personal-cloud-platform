import { z } from 'zod';

export const userPreferencesSchema = z.object({
  userId: z.string().uuid(),
  defaultProvider: z.string().nullable().optional(),
  defaultModel: z.string().nullable().optional(),
  theme: z.string().default('system'),
  terminalRiskLevel: z.string().default('normal'),
  bio: z.string().nullable().optional(),
  rules: z.string().nullable().optional(),
  notificationPrefs: z.object({
    inApp: z.boolean().optional(),
    emailMock: z.boolean().optional(),
    webhookUrl: z.string().nullable().optional(),
  }).nullable().optional(),
  updatedAt: z.date(),
});

export const updateUserPreferencesSchema = z.object({
  defaultProvider: z.string().nullable().optional(),
  defaultModel: z.string().nullable().optional(),
  theme: z.string().optional(),
  terminalRiskLevel: z.string().optional(),
  bio: z.string().nullable().optional(),
  rules: z.string().nullable().optional(),
  notificationPrefs: z.object({
    inApp: z.boolean().optional(),
    emailMock: z.boolean().optional(),
    webhookUrl: z.string().nullable().optional(),
  }).nullable().optional(),
});

export const providerCredentialResponseSchema = z.object({
  id: z.string().uuid(),
  provider: z.string(),
  label: z.string().nullable(),
  maskedKey: z.string(), // We don't send the real key
  lastUsedAt: z.date().nullable(),
  createdAt: z.date(),
});

export const createProviderCredentialSchema = z.object({
  provider: z.string().min(1),
  label: z.string().optional(),
  key: z.string().min(1), // Plain text key to be encrypted on backend
});

export const auditLogSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  action: z.string(),
  details: z.record(z.unknown()).nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.date(),
});
