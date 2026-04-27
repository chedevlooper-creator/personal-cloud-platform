#!/usr/bin/env node
/**
 * Encrypts any plaintext values left in `hosted_services.env_vars`.
 *
 * Run from repo root:
 *   ENCRYPTION_KEY=<32-byte string> DATABASE_URL=postgres://... \
 *     pnpm --filter @pcp/publish-service exec tsx ../../scripts/encrypt-envvars.mjs
 *
 * Or with the dev fallback (publish service derives a sha256 dev key when
 * ENCRYPTION_KEY is unset):
 *   DATABASE_URL=postgres://... \
 *     pnpm --filter @pcp/publish-service exec tsx ../../scripts/encrypt-envvars.mjs
 *
 * Use --dry to print what would change without writing.
 *
 * Idempotent: rows whose values already start with `enc:` are skipped.
 */

import crypto from 'node:crypto';
import process from 'node:process';

const ALGORITHM = 'aes-256-gcm';
const ENC_PREFIX = 'enc:';

function resolveKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (raw && Buffer.byteLength(raw, 'utf8') === 32) return Buffer.from(raw, 'utf8');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY must be exactly 32 bytes in production');
  }
  // Mirrors services/publish/src/env.ts dev fallback.
  const fallback = crypto.createHash('sha256').update('pcp-publish-dev-key').digest('hex').slice(0, 32);
  return Buffer.from(fallback, 'utf8');
}

function encryptValue(key, plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`;
}

async function main() {
  const dry = process.argv.includes('--dry');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const key = resolveKey();

  const { default: postgres } = await import('postgres');
  const sql = postgres(dbUrl, { max: 1 });

  try {
    const rows = await sql`SELECT id, env_vars FROM hosted_services`;
    let totalRows = 0;
    let totalValues = 0;
    let updatedRows = 0;
    let updatedValues = 0;

    for (const row of rows) {
      totalRows += 1;
      const envVars = row.env_vars;
      if (!envVars || typeof envVars !== 'object') continue;

      const next = {};
      let changed = false;
      for (const [k, v] of Object.entries(envVars)) {
        totalValues += 1;
        if (typeof v !== 'string') {
          next[k] = v;
          continue;
        }
        if (v.startsWith(ENC_PREFIX)) {
          next[k] = v;
        } else {
          next[k] = encryptValue(key, v);
          changed = true;
          updatedValues += 1;
        }
      }

      if (changed) {
        updatedRows += 1;
        if (!dry) {
          await sql`UPDATE hosted_services SET env_vars = ${sql.json(next)} WHERE id = ${row.id}`;
        }
        console.log(
          `${dry ? '[dry] ' : ''}row ${row.id}: encrypted ${
            Object.keys(next).filter((k) => next[k] !== envVars[k]).length
          } value(s)`,
        );
      }
    }

    console.log(
      `\nDone. rows scanned=${totalRows} values scanned=${totalValues} rows updated=${updatedRows} values encrypted=${updatedValues}${
        dry ? ' (dry-run)' : ''
      }`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
