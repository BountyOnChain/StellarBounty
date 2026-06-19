#!/usr/bin/env bash
# =============================================================================
# StellarBounty — Database Backup Script
#
# Creates a timestamped, compressed PostgreSQL dump using pg_dump.
# Supports local storage and optional S3 upload.
#
# Usage:
#   ./scripts/backup-db.sh                          # local backup only
#   ./scripts/backup-db.sh --s3                      # local + S3 upload
#   ./scripts/backup-db.sh --s3-bucket my-bucket     # custom S3 bucket
#
# Environment:
#   DATABASE_URL         PostgreSQL connection string (required)
#   BACKUP_DIR           Local backup directory (default: ./backups)
#   BACKUP_S3_BUCKET     S3 bucket name for remote storage (optional)
#   BACKUP_RETENTION_DAYS Number of days to keep local backups (default: 7)
#   AWS_ACCESS_KEY_ID    AWS access key (required for S3)
#   AWS_SECRET_ACCESS_KEY AWS secret key (required for S3)
#   AWS_DEFAULT_REGION   AWS region (default: us-east-1)
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
S3_BUCKET="${BACKUP_S3_BUCKET:-stellar-bounty-db-backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/stellar_bounty_${TIMESTAMP}.dump"
LATEST_LINK="${BACKUP_DIR}/latest.dump"

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  echo "Usage: DATABASE_URL=postgresql://user:pass@host:5432/dbname $0" >&2
  exit 1
fi

command -v pg_dump >/dev/null 2>&1 || { echo "ERROR: pg_dump is not installed." >&2; exit 1; }

# ---------------------------------------------------------------------------
# Create backup directory
# ---------------------------------------------------------------------------
mkdir -p "${BACKUP_DIR}"

# ---------------------------------------------------------------------------
# Perform backup
# ---------------------------------------------------------------------------
echo "[$(date +%H:%M:%S)] Starting backup: ${BACKUP_FILE}"

pg_dump "${DATABASE_URL}" \
  --format=custom \
  --compress=9 \
  --verbose \
  --no-owner \
  --no-acl \
  --file="${BACKUP_FILE}" 2>&1

echo "[$(date +%H:%M:%S)] Backup completed: ${BACKUP_FILE}"

# ---------------------------------------------------------------------------
# Update latest symlink
# ---------------------------------------------------------------------------
ln -sf "$(basename "${BACKUP_FILE}")" "${LATEST_LINK}"

# ---------------------------------------------------------------------------
# Report file size
# ---------------------------------------------------------------------------
FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date +%H:%M:%S)] Backup size: ${FILE_SIZE}"

# ---------------------------------------------------------------------------
# Cleanup old local backups
# ---------------------------------------------------------------------------
echo "[$(date +%H:%M:%S)] Cleaning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "stellar_bounty_*.dump" -type f -mtime "+${RETENTION_DAYS}" -delete

# ---------------------------------------------------------------------------
# S3 upload (if --s3 flag or S3 bucket is configured)
# ---------------------------------------------------------------------------
upload_to_s3() {
  if command -v aws >/dev/null 2>&1; then
    echo "[$(date +%H:%M:%S)] Uploading to s3://${S3_BUCKET}/..."
    aws s3 cp "${BACKUP_FILE}" "s3://${S3_BUCKET}/$(basename "${BACKUP_FILE}")" --no-progress
    aws s3 cp "${BACKUP_DIR}/latest.dump" "s3://${S3_BUCKET}/latest.dump" --no-progress
    echo "[$(date +%H:%M:%S)] S3 upload completed."
  else
    echo "WARNING: AWS CLI not found. Skipping S3 upload." >&2
  fi
}

if [[ "$*" == *"--s3"* ]] || [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  upload_to_s3
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo "[$(date +%H:%M:%S)] Backup process finished successfully."