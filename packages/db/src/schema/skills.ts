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
import { workspaces } from './workspaces';

/**
 * Skills are SKILL.md-based capabilities scoped to a user (and optionally workspace).
 * Source-of-truth content lives at <workspace>/Skills/<slug>/SKILL.md when a workspaceId
 * is set; otherwise it is a global user-level skill stored in `bodyMarkdown`.
 */
export const skills = pgTable(
  'skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 120 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    bodyMarkdown: text('body_markdown'),
    sourcePath: varchar('source_path', { length: 1024 }),
    triggers: jsonb('triggers').$type<string[]>().default([]).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => ({
    userSlugIdx: index('skills_user_slug_idx').on(t.userId, t.workspaceId, t.slug),
    enabledIdx: index('skills_enabled_idx').on(t.userId, t.enabled, t.deletedAt),
  }),
);
