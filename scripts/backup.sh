#!/usr/bin/env bash
# ==============================================================================
# panda.vault Encrypted Database Backup Script
# Performs streaming pg_dump, compresses with gzip, and encrypts with AES-256
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/pandavault}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/pandavault_backup_${TIMESTAMP}.sql.gz.enc"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "ERROR: BACKUP_ENCRYPTION_KEY environment variable is not set." >&2
  exit 1
fi

echo "[$(date)] Starting encrypted database backup..."

# Dump, compress, and encrypt in a streaming pipeline
docker exec pandavault_db pg_dump -U "${POSTGRES_USER:-vaultx}" "${POSTGRES_DB:-vaultx_prod}" \
  | gzip -9 \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -salt -pass env:BACKUP_ENCRYPTION_KEY \
  > "${BACKUP_FILE}"

chmod 600 "${BACKUP_FILE}"
echo "[$(date)] Backup completed successfully: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"

# Prune backups older than retention window
echo "[$(date)] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "pandavault_backup_*.sql.gz.enc" -type f -mtime +"${RETENTION_DAYS}" -delete
echo "[$(date)] Backup rotation complete."
