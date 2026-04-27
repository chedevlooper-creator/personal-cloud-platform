#!/usr/bin/env bash
# scripts/backup.sh
# Self-hosted backup helper for personal-cloud-platform.
#
# Dumps Postgres with pg_dump and mirrors the MinIO `pcp` bucket via the `mc` CLI.
# Designed for a nightly cron (or systemd timer). Idempotent. Safe to run while services run.
#
# Usage:
#   ./scripts/backup.sh /path/to/backup-root
#
# Required env (same names as infra/docker/.env):
#   POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_HOST (default: localhost)
#   MINIO_ROOT_USER, MINIO_ROOT_PASSWORD, MINIO_ENDPOINT (default: http://localhost:9000)
#   MINIO_BUCKET (default: pcp)
#
# Optional:
#   BACKUP_RETENTION_DAYS (default: 14)
#   BACKUP_REMOTE_S3_TARGET (e.g. s3://my-offsite/pcp). When set, mirrored after local backup.
#
# Exit codes: 0 success | non-zero on first failed step (set -e).

set -euo pipefail

BACKUP_ROOT="${1:-./backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="${BACKUP_ROOT}/${TIMESTAMP}"
mkdir -p "${DEST}"

POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
MINIO_BUCKET="${MINIO_BUCKET:-pcp}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

echo "[$(date -u +%H:%M:%SZ)] backup → ${DEST}"

# 1) Postgres dump (custom format → smaller + parallel restore)
PGPASSFILE="$(mktemp)"
trap 'rm -f "${PGPASSFILE}"' EXIT
echo "${POSTGRES_HOST}:${POSTGRES_PORT}:${POSTGRES_DB}:${POSTGRES_USER}:${POSTGRES_PASSWORD}" > "${PGPASSFILE}"
chmod 600 "${PGPASSFILE}"
PGPASSFILE="${PGPASSFILE}" pg_dump \
  -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
  -F c -Z 6 -f "${DEST}/postgres.dump"
echo "  ✔ postgres.dump ($(du -h "${DEST}/postgres.dump" | awk '{print $1}'))"

# 2) MinIO mirror (workspace files, snapshots, etc.)
if command -v mc >/dev/null 2>&1; then
  mc alias set pcp_local "${MINIO_ENDPOINT}" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" >/dev/null
  mc mirror --quiet --overwrite "pcp_local/${MINIO_BUCKET}" "${DEST}/minio/"
  echo "  ✔ minio mirrored"
else
  echo "  ⚠ mc CLI not found — skipping MinIO mirror. Install from https://min.io/docs/minio/linux/reference/minio-mc.html"
fi

# 3) Optional offsite push
if [[ -n "${BACKUP_REMOTE_S3_TARGET:-}" ]] && command -v mc >/dev/null 2>&1; then
  echo "  → pushing to ${BACKUP_REMOTE_S3_TARGET}"
  mc mirror --quiet --overwrite "${DEST}" "${BACKUP_REMOTE_S3_TARGET}/${TIMESTAMP}/"
  echo "  ✔ offsite mirror ok"
fi

# 4) Retention prune (local only)
find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" \
  -exec echo "  ↻ pruning {}" \; -exec rm -rf {} \;

echo "[$(date -u +%H:%M:%SZ)] backup complete"
