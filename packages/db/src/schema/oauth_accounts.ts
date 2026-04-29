import { pgTable, timestamp, uuid, varchar, primaryKey, text } from 'drizzle-orm/pg-core';
import { users } from './users';

export const oauthAccounts = pgTable('oauth_accounts', {
  providerId: varchar('provider_id', { length: 255 }).notNull(),
  providerUserId: varchar('provider_user_id', { length: 255 }).notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.providerId, table.providerUserId] }),
}));
