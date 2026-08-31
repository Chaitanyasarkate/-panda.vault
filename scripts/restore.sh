#!/usr/bin/env bash
# ==============================================================================
# panda.vault Encrypted Database Restore Script
# Decrypts AES-256 backup and streams into PostgreSQL container
# ==============================================================================

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <path_to_backup_file.sql.gz.enc>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERROR: File '${BACKUP_FILE}' not found." >&2
  exit 1
fi

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "ERROR: BACKUP_ENCRYPTION_KEY environment variable is not set." >&2
  exit 1
fi

read -p "WARNING: This will overwrite existing database records in pandavault_db. Continue? (y/N): " -r
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Restore cancelled."
  exit 0
fi

echo "[$(date)] Decrypting and restoring database from ${BACKUP_FILE}..."

openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -pass env:BACKUP_ENCRYPTION_KEY -in "${BACKUP_FILE}" \
  | gunzip \
  | docker exec -i pandavault_db psql -U "${POSTGRES_USER:-vaultx}" -d "${POSTGRES_DB:-vaultx_prod}"

echo "[$(date)] Database restore completed successfully."
