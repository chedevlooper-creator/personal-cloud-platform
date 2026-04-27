import {
  pgTable,
  timestamp,
  uuid,
  varchar,
  jsonb,
  index,
  uniqueIndex,
  boolean,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { workspaces } from './workspaces';

/**
 * Channel links map an external messaging account (Telegram chat, email From,
 * Discord user, etc.) to a CloudMind user, so inbound messages can route to
 * the right person and an existing chat thread when one exists.
 */
export const channelLinks = pgTable(
  'channel_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
    channel: varchar('channel', { length: 32 }).notNull(), // telegram | email | discord | sms
    externalId: varchar('external_id', { length: 256 }).notNull(), // chat id / from address / etc
    label: varchar('label', { length: 200 }),
    enabled: boolean('enabled').default(true).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    userChannelIdx: index('channel_links_user_idx').on(t.userId, t.channel),
    externalIdx: uniqueIndex('channel_links_external_uidx').on(t.channel, t.externalId),
  }),
);
