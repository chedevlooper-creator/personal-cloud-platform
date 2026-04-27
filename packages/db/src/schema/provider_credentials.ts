import {
  pgTable,
  timestamp,
  uuid,
  varchar,
  text,
  jsonb,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Encrypted credentials for AI providers (BYOK) and integrations.
 * `encryptedKey` is AES-256-GCM ciphertext; `iv` and `authTag` stored separately.
 * Plaintext is never persisted, never logged, never returned to client.
 */
export const providerCredentials = pgTable(
  'provider_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 32 }).notNull(), // openai|anthropic|google|mock
    label: varchar('label', { length: 80 }),
    encryptedKey: text('encrypted_key').notNull(), // base64
    iv: varchar('iv', { length: 64 }).notNull(), // base64
    authTag: varchar('auth_tag', { length: 64 }).notNull(), // base64
    keyVersion: varchar('key_version', { length: 16 }).default('v1').notNull(),
    lastUsedAt: timestamp('last_used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    revokedAt: timestamp('revoked_at'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (t) => ({
    userIdx: index('provider_credentials_user_idx').on(t.userId),
    activeIdx: index('provider_credentials_active_idx').on(t.userId, t.provider, t.revokedAt),
  }),
);

export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  defaultProvider: varchar('default_provider', { length: 32 }),
  defaultModel: varchar('default_model', { length: 120 }),
  theme: varchar('theme', { length: 16 }).default('system').notNull(),
  terminalRiskLevel: varchar('terminal_risk_level', { length: 16 }).default('normal').notNull(),
  bio: text('bio'),
  rules: text('rules'), // user "rules" injected into system prompt
  notificationPrefs: jsonb('notification_prefs').$type<{
    inApp?: boolean;
    emailMock?: boolean;
    webhookUrl?: string | null;
  }>(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const personas = pgTable(
  'personas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 80 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    systemPrompt: text('system_prompt').notNull(),
    icon: varchar('icon', { length: 80 }),
    isDefault: boolean('is_default').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    userSlugIdx: index('personas_user_slug_idx').on(t.userId, t.slug),
  }),
);
