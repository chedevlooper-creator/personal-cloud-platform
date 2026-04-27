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

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 32 }).notNull(),
    // automation_run | approval_required | service_crashed | snapshot_ready | system
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body'),
    severity: varchar('severity', { length: 16 }).default('info').notNull(), // info | warn | error | success
    link: varchar('link', { length: 500 }),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('notifications_user_idx').on(t.userId, t.readAt, t.createdAt),
  }),
);

export const integrations = pgTable(
  'integrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 32 }).notNull(),
    // gmail-mock | gdrive-mock | notion-mock | webhook
    label: varchar('label', { length: 120 }),
    config: jsonb('config').$type<Record<string, unknown>>().default({}).notNull(),
    encryptedSecret: text('encrypted_secret'),
    iv: varchar('iv', { length: 64 }),
    authTag: varchar('auth_tag', { length: 64 }),
    isEnabled: boolean('is_enabled').default(true).notNull(),
    lastSyncAt: timestamp('last_sync_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => ({
    userIdx: index('integrations_user_idx').on(t.userId, t.deletedAt),
  }),
);
