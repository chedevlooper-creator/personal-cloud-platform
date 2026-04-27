/**
 * Dev seed script — idempotent.
 *
 * Picks an existing user (by SEED_EMAIL or first user in DB) and attaches sample
 * resources: a workspace, a few skills, a couple of datasets, two hosted services,
 * and a sample automation. Re-running is safe; rows are matched by stable keys
 * (slug / table_name / title) and skipped if present.
 *
 * Does NOT create users — register through the app first, then run:
 *   pnpm --filter @pcp/db seed
 *   SEED_EMAIL=me@example.com pnpm --filter @pcp/db seed
 *
 * DuckDB physical tables:
 *   Requires @duckdb/node-api. Install with:
 *     pnpm --filter @pcp/workspace-service add @duckdb/node-api
 *   Then set DATASETS_DATA_DIR (default: ./data/datasets relative to cwd).
 *   If the binary is not available, DuckDB seeding is skipped gracefully.
 */
import * as nodePath from 'node:path';
import { promises as nodeFs } from 'node:fs';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from './client';
import * as schema from './schema';

async function pickUser(): Promise<{ id: string; email: string } | null> {
  const email = process.env.SEED_EMAIL;
  if (email) {
    const rows = await db
      .select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    return rows[0] ?? null;
  }
  const rows = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .limit(1);
  return rows[0] ?? null;
}

async function ensureWorkspace(userId: string): Promise<string> {
  const name = 'Sandbox';
  const existing = await db
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces)
    .where(
      and(
        eq(schema.workspaces.userId, userId),
        eq(schema.workspaces.name, name),
        isNull(schema.workspaces.deletedAt),
      ),
    )
    .limit(1);
  if (existing[0]) {
    console.log(`  ✓ workspace "${name}" exists (${existing[0].id})`);
    return existing[0].id;
  }
  const inserted = await db
    .insert(schema.workspaces)
    .values({ userId, name })
    .returning({ id: schema.workspaces.id });
  console.log(`  + workspace "${name}" created (${inserted[0]!.id})`);
  return inserted[0]!.id;
}

async function ensureSkill(
  userId: string,
  workspaceId: string,
  slug: string,
  name: string,
  description: string,
  body: string,
  triggers: string[],
): Promise<void> {
  const existing = await db
    .select({ id: schema.skills.id })
    .from(schema.skills)
    .where(
      and(
        eq(schema.skills.userId, userId),
        eq(schema.skills.slug, slug),
        isNull(schema.skills.deletedAt),
      ),
    )
    .limit(1);
  if (existing[0]) {
    console.log(`  ✓ skill ${slug} exists`);
    return;
  }
  await db.insert(schema.skills).values({
    userId,
    workspaceId,
    slug,
    name,
    description,
    bodyMarkdown: body,
    triggers,
    enabled: true,
  });
  console.log(`  + skill ${slug} created`);
}

async function ensureDataset(
  userId: string,
  name: string,
  tableName: string,
  columns: Array<{ name: string; type: string }>,
  rowCount: number,
  sizeBytes: number,
): Promise<void> {
  const existing = await db
    .select({ id: schema.datasets.id })
    .from(schema.datasets)
    .where(
      and(
        eq(schema.datasets.userId, userId),
        eq(schema.datasets.tableName, tableName),
        isNull(schema.datasets.deletedAt),
      ),
    )
    .limit(1);
  if (existing[0]) {
    console.log(`  ✓ dataset ${tableName} exists`);
    return;
  }
  await db.insert(schema.datasets).values({
    userId,
    name,
    tableName,
    sourceType: 'csv',
    sourceFilename: `${tableName}.csv`,
    columns,
    rowCount,
    sizeBytes,
  });
  console.log(`  + dataset ${tableName} created (${rowCount} rows)`);
}

async function ensureHostedService(
  userId: string,
  workspaceId: string,
  slug: string,
  name: string,
  kind: 'static' | 'vite' | 'node',
  rootPath: string,
  startCommand: string | null,
): Promise<void> {
  const existing = await db
    .select({ id: schema.hostedServices.id })
    .from(schema.hostedServices)
    .where(
      and(
        eq(schema.hostedServices.userId, userId),
        eq(schema.hostedServices.slug, slug),
        isNull(schema.hostedServices.deletedAt),
      ),
    )
    .limit(1);
  if (existing[0]) {
    console.log(`  ✓ hosted-service ${slug} exists`);
    return;
  }
  await db.insert(schema.hostedServices).values({
    userId,
    workspaceId,
    slug,
    name,
    kind,
    rootPath,
    startCommand,
    envVars: {},
    isPublic: false,
    autoRestart: true,
    status: 'stopped',
  });
  console.log(`  + hosted-service ${slug} created (${kind})`);
}

async function ensureAutomation(
  userId: string,
  workspaceId: string,
  title: string,
  prompt: string,
  scheduleType: 'manual' | 'hourly' | 'daily' | 'weekly' | 'cron',
  cronExpression: string | null,
): Promise<void> {
  const existing = await db
    .select({ id: schema.automations.id })
    .from(schema.automations)
    .where(
      and(
        eq(schema.automations.userId, userId),
        eq(schema.automations.title, title),
        isNull(schema.automations.deletedAt),
      ),
    )
    .limit(1);
  if (existing[0]) {
    console.log(`  ✓ automation "${title}" exists`);
    return;
  }
  await db.insert(schema.automations).values({
    userId,
    workspaceId,
    title,
    prompt,
    scheduleType,
    cronExpression,
    timezone: 'UTC',
    enabled: scheduleType !== 'manual',
    notificationMode: 'in-app',
  });
  console.log(`  + automation "${title}" created (${scheduleType})`);
}

/**
 * Optionally seed physical DuckDB tables for the sample datasets.
 *
 * Requires @duckdb/node-api to be installed (it is an optional native binding).
 * Skipped gracefully if the binary is absent.
 */
async function seedDuckDbDatasets(userId: string): Promise<void> {
  const dataDir = nodePath.resolve(process.env.DATASETS_DATA_DIR ?? './data/datasets');
  const dbPath = nodePath.join(dataDir, `${userId}.duckdb`);

  let mod: any;
  try {
    mod = await (Function('s', 'return import(s)') as (s: string) => Promise<any>)(
      '@duckdb/node-api',
    );
  } catch {
    console.log(
      '  ⚠️  @duckdb/node-api not available — skipping DuckDB physical table creation.\n' +
        '     To enable: pnpm --filter @pcp/workspace-service add @duckdb/node-api',
    );
    return;
  }

  await nodeFs.mkdir(dataDir, { recursive: true });
  const instance = await mod.DuckDBInstance.create(dbPath);
  const conn = await instance.connect();

  try {
    // --- expenses ---
    await conn.run(`CREATE TABLE IF NOT EXISTS "expenses" (
      date DATE, category VARCHAR, amount DOUBLE, note VARCHAR
    )`);
    const expRows = await conn.all(`SELECT count(*) FROM "expenses"`);
    if (Number(expRows.rows[0]?.[0] ?? 0) === 0) {
      await conn.run(`INSERT INTO "expenses" VALUES
        ('2024-01-05','Food',12.80,'Lunch'),
        ('2024-01-08','Transport',25.00,'Monthly pass'),
        ('2024-01-12','Food',45.20,'Groceries'),
        ('2024-01-18','Software',199.00,'Annual subscription'),
        ('2024-01-22','Food',18.60,'Dinner out'),
        ('2024-02-01','Utilities',72.30,'Electricity'),
        ('2024-02-05','Food',22.40,'Lunch'),
        ('2024-02-14','Entertainment',35.00,'Cinema'),
        ('2024-02-20','Transport',25.00,'Monthly pass'),
        ('2024-02-28','Food',88.10,'Groceries')
      `);
      console.log('  + duckdb table "expenses" seeded (10 rows)');
    } else {
      console.log('  ✓ duckdb table "expenses" already has rows');
    }

    // --- site_traffic ---
    await conn.run(`CREATE TABLE IF NOT EXISTS "site_traffic" (
      day DATE, source VARCHAR, visits INTEGER, bounce_rate DOUBLE
    )`);
    const trafficRows = await conn.all(`SELECT count(*) FROM "site_traffic"`);
    if (Number(trafficRows.rows[0]?.[0] ?? 0) === 0) {
      await conn.run(`INSERT INTO "site_traffic" VALUES
        ('2024-01-01','organic',142,0.42),
        ('2024-01-01','direct',87,0.31),
        ('2024-01-01','referral',33,0.55),
        ('2024-01-02','organic',161,0.39),
        ('2024-01-02','direct',91,0.28),
        ('2024-01-02','social',22,0.61),
        ('2024-01-03','organic',138,0.44),
        ('2024-01-03','direct',75,0.33),
        ('2024-01-03','email',55,0.25),
        ('2024-01-04','organic',178,0.37)
      `);
      console.log('  + duckdb table "site_traffic" seeded (10 rows)');
    } else {
      console.log('  ✓ duckdb table "site_traffic" already has rows');
    }

    // Backfill sizeBytes from the actual duckdb file.
    const stat = await nodeFs.stat(dbPath).catch(() => null);
    if (stat) {
      for (const tableName of ['expenses', 'site_traffic'] as const) {
        await db
          .update(schema.datasets)
          .set({ sizeBytes: stat.size, updatedAt: new Date() })
          .where(
            and(
              eq(schema.datasets.userId, userId),
              eq(schema.datasets.tableName, tableName),
              isNull(schema.datasets.deletedAt),
            ),
          );
      }
      console.log(`  ✓ postgres sizeBytes updated from ${dbPath} (${stat.size} B)`);
    }
  } finally {
    await conn.close().catch(() => {});
  }
}

async function main() {
  console.log('\uD83C\uDF31 Seeding dev data...');

  const user = await pickUser();
  if (!user) {
    console.error(
      '❌ No user found. Register via the app first, then run with SEED_EMAIL=you@example.com',
    );
    process.exit(1);
  }
  console.log(`👤 Using user ${user.email} (${user.id})`);

  const workspaceId = await ensureWorkspace(user.id);

  console.log('📚 Skills');
  await ensureSkill(
    user.id,
    workspaceId,
    'summarize-docs',
    'Summarize Documents',
    'Summarize long documents into bullet points with key takeaways.',
    '# Summarize Documents\n\nWhen the user asks for a summary, return:\n- 3–5 bullet points\n- Key entities\n- A 2-sentence TL;DR\n',
    ['summarize', 'tldr', 'summary'],
  );
  await ensureSkill(
    user.id,
    workspaceId,
    'sql-helper',
    'SQL Helper',
    'Generate and explain SQL queries against the user dataset DuckDB.',
    '# SQL Helper\n\nPrefer parameterized SELECT queries. Always preview row counts before destructive operations.\n',
    ['sql', 'query', 'duckdb'],
  );
  await ensureSkill(
    user.id,
    workspaceId,
    'web-research',
    'Web Research',
    'Open the cloud browser, gather sources, and produce a cited report.',
    '# Web Research\n\nUse the cloud browser to collect 3+ independent sources, cite each claim, and summarize findings.\n',
    ['research', 'browse', 'investigate'],
  );

  console.log('🗃️  Datasets');
  await ensureDataset(
    user.id,
    'Expenses (sample)',
    'expenses',
    [
      { name: 'date', type: 'DATE' },
      { name: 'category', type: 'VARCHAR' },
      { name: 'amount', type: 'DOUBLE' },
      { name: 'note', type: 'VARCHAR' },
    ],
    142,
    18_240,
  );
  await ensureDataset(
    user.id,
    'Site Traffic (sample)',
    'site_traffic',
    [
      { name: 'day', type: 'DATE' },
      { name: 'source', type: 'VARCHAR' },
      { name: 'visits', type: 'INTEGER' },
      { name: 'bounce_rate', type: 'DOUBLE' },
    ],
    365,
    42_880,
  );

  console.log('🌐 Hosted services');
  await ensureHostedService(
    user.id,
    workspaceId,
    'portfolio',
    'Portfolio Site',
    'static',
    'sites/portfolio',
    null,
  );
  await ensureHostedService(
    user.id,
    workspaceId,
    'notes-api',
    'Notes API',
    'node',
    'apps/notes-api',
    'node server.js',
  );

  console.log('⏰ Automations');
  await ensureAutomation(
    user.id,
    workspaceId,
    'Daily inbox digest',
    'Summarize unread items in my linked channels and produce a 5-bullet morning digest.',
    'daily',
    null,
  );
  await ensureAutomation(
    user.id,
    workspaceId,
    'Weekly storage report',
    'Report total storage usage across workspaces and flag anything over 80% quota.',
    'weekly',
    null,
  );

  console.log('\uD83E\uDD86  DuckDB physical tables');
  await seedDuckDbDatasets(user.id);

  console.log('\u2705 Seeding completed');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});