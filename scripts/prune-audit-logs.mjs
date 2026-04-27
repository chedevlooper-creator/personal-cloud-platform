#!/usr/bin/env node
/**
 * Prunes audit_logs entries older than AUDIT_RETENTION_DAYS (default 90).
 *
 * Run from repo root:
 *   DATABASE_URL=postgres://... node scripts/prune-audit-logs.mjs
 *
 * Env:
 *   DATABASE_URL          required
 *   AUDIT_RETENTION_DAYS  optional, integer >= 1, default 90
 *
 * Flags:
 *   --dry   count what would be deleted without writing
 *
 * Suggested cron (daily at 04:00):
 *   0 4 * * * cd /opt/pcp && DATABASE_URL=... node scripts/prune-audit-logs.mjs >> /var/log/pcp-audit-prune.log 2>&1
 */

import process from 'node:process';

async function main() {
  const dry = process.argv.includes('--dry');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const daysRaw = process.env.AUDIT_RETENTION_DAYS;
  const days = Number.isFinite(Number(daysRaw)) && Number(daysRaw) >= 1 ? Math.floor(Number(daysRaw)) : 90;

  const { default: postgres } = await import('postgres');
  const sql = postgres(dbUrl, { max: 1 });

  try {
    const cutoff = await sql`SELECT NOW() - (${days} || ' days')::INTERVAL AS cutoff`;
    const cutoffIso = cutoff[0]?.cutoff?.toISOString?.() ?? String(cutoff[0]?.cutoff);

    const countRow = await sql`
      SELECT COUNT(*)::int AS n
      FROM audit_logs
      WHERE created_at < NOW() - (${days} || ' days')::INTERVAL
    `;
    const toDelete = countRow[0]?.n ?? 0;

    console.log(`audit_logs older than ${days} days (cutoff ${cutoffIso}): ${toDelete} row(s)`);

    if (dry || toDelete === 0) {
      console.log(dry ? '(dry-run, no changes)' : 'nothing to prune');
      return;
    }

    const deleted = await sql`
      DELETE FROM audit_logs
      WHERE created_at < NOW() - (${days} || ' days')::INTERVAL
    `;
    console.log(`pruned ${deleted.count} row(s)`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
