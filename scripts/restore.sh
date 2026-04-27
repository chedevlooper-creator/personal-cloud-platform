#!/usr/bin/env bash
# scripts/restore.sh
# Restore from a timestamped backup directory produced by scripts/backup.sh.
#
# Usage: ./scripts/restore.sh /path/to/backups/<TIMESTAMP>
#
# WARNING: drops the existing database. Confirm with RESTORE_CONFIRM=yes.
set -euo pipefail

BACKUP_DIR="${1:?backup directory required}"
[[ -f "${BACKUP_DIR}/postgres.dump" ]] || { echo "missing postgres.dump"; exit 1; }

POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
MINIO_BUCKET="${MINIO_BUCKET:-pcp}"

if [[ "${RESTORE_CONFIRM:-}" != "yes" ]]; then
  echo "Refusing to run without RESTORE_CONFIRM=yes (this drops ${POSTGRES_DB})."
  exit 2
fi

PGPASSFILE="$(mktemp)"; trap 'rm -f "${PGPASSFILE}"' EXIT
echo "${POSTGRES_HOST}:${POSTGRES_PORT}:${POSTGRES_DB}:${POSTGRES_USER}:${POSTGRES_PASSWORD}" > "${PGPASSFILE}"
chmod 600 "${PGPASSFILE}"

echo "→ dropping & recreating ${POSTGRES_DB}"
PGPASSFILE="${PGPASSFILE}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d postgres \
  -c "DROP DATABASE IF EXISTS \"${POSTGRES_DB}\";" \
  -c "CREATE DATABASE \"${POSTGRES_DB}\";"

echo "→ pg_restore"
PGPASSFILE="${PGPASSFILE}" pg_restore -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" --clean --if-exists --no-owner -j 4 "${BACKUP_DIR}/postgres.dump"

if [[ -d "${BACKUP_DIR}/minio" ]] && command -v mc >/dev/null 2>&1; then
  echo "→ mirror MinIO bucket"
  mc alias set pcp_local "${MINIO_ENDPOINT}" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" >/dev/null
  mc mirror --quiet --overwrite "${BACKUP_DIR}/minio/" "pcp_local/${MINIO_BUCKET}"
fi

echo "✔ restore complete"
