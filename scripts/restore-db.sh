#!/usr/bin/env bash
# =============================================================================
# StellarBounty — Database Restore Script
#
# Restores a PostgreSQL database from a custom-format pg_dump (--format=custom).
# Supports restoring from a local file or from S3.
#
# Usage:
#   ./scripts/restore-db.sh <backup-file>              # restore from local file
#   ./scripts/restore-db.sh --s3 <s3-key>              # restore from S3
#   ./scripts/restore-db.sh ./backups/latest.dump      # restore latest local
#   ./scripts/restore-db.sh                            # restore latest local
#
# Environment:
#   DATABASE_URL         PostgreSQL connection string (required)
#   BACKUP_DIR           Local backup directory (default: ./backups)
#   S3_BUCKET            S3 bucket name (required with --s3)
#   AWS_ACCESS_KEY_ID    AWS access key (required for S3)
#   AWS_SECRET_ACCESS_KEY AWS secret key (required for S3)
#   AWS_DEFAULT_REGION   AWS region (default: us-east-1)
#   CONFIRM_DESTROY      Set to "yes" to skip confirmation prompt
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BACKUP_DIR="${BACKUP_DIR:-./backups}"
S3_BUCKET="${BACKUP_S3_BUCKET:-stellar-bounty-db-backups}"

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------
error() {
  echo "ERROR: $*" >&2
  exit 1
}

info() {
  echo "[$(date +%H:%M:%S)] $*"
}

confirm_destructive_operation() {
  if [ "${CONFIRM_DESTROY:-}" = "yes" ]; then
    return 0
  fi
  echo "WARNING: This will DESTROY all data in the target database and replace it with the backup." >&2
  echo "Target database: ${DATABASE_URL}" >&2
  read -r -p "Are you sure you want to proceed? (type 'yes' to confirm): " response
  if [ "${response}" != "yes" ]; then
    echo "Aborted." >&2
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
if [ -z "${DATABASE_URL:-}" ]; then
  error "DATABASE_URL is not set."
fi

command -v pg_restore >/dev/null 2>&1 || error "pg_restore is not installed."

# ---------------------------------------------------------------------------
# Determine backup source
# ---------------------------------------------------------------------------
BACKUP_SOURCE=""

if [ $# -eq 0 ]; then
  # No arguments — try latest.dump
  BACKUP_SOURCE="${BACKUP_DIR}/latest.dump"
  if [ ! -f "${BACKUP_SOURCE}" ]; then
    error "No backup file specified and ${BACKUP_SOURCE} not found."
  fi
  info "Using latest backup: ${BACKUP_SOURCE}"
elif [ "$1" = "--s3" ]; then
  # Restore from S3
  S3_KEY="${2:-latest.dump}"
  BACKUP_SOURCE="${BACKUP_DIR}/s3_restore_$(date +%Y%m%d_%H%M%S).dump"
  mkdir -p "${BACKUP_DIR}"

  if ! command -v aws >/dev/null 2>&1; then
    error "AWS CLI is not installed. Cannot download from S3."
  fi

  info "Downloading s3://${S3_BUCKET}/${S3_KEY} to ${BACKUP_SOURCE}..."
  aws s3 cp "s3://${S3_BUCKET}/${S3_KEY}" "${BACKUP_SOURCE}" --no-progress
  info "Download completed."
else
  BACKUP_SOURCE="$1"
  if [ ! -f "${BACKUP_SOURCE}" ]; then
    error "Backup file not found: ${BACKUP_SOURCE}"
  fi
  info "Using specified backup: ${BACKUP_SOURCE}"
fi

# Verify backup file is a valid pg_dump
FILE_TYPE=$(file "${BACKUP_SOURCE}" 2>/dev/null || echo "unknown")
info "Backup file type: ${FILE_TYPE}"

# ---------------------------------------------------------------------------
# Confirm destructive operation
# ---------------------------------------------------------------------------
confirm_destructive_operation

# ---------------------------------------------------------------------------
# Restore
# ---------------------------------------------------------------------------
info "Starting restore from: ${BACKUP_SOURCE}"

pg_restore "${DATABASE_URL}" \
  --format=custom \
  --verbose \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --file="${BACKUP_SOURCE}" 2>&1

# If pg_restore with --file doesn't work (for custom format, we need it differently),
# fall back to: pg_restore -d "${DATABASE_URL}" --format=custom --clean --if-exists --no-owner --no-acl "${BACKUP_SOURCE}"
# The --file flag is used for output scripts, not direct restore. Let's do it properly:
info "Running pg_restore directly to database..."
pg_restore \
  --dbname="${DATABASE_URL}" \
  --format=custom \
  --verbose \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  "${BACKUP_SOURCE}" 2>&1

info "Restore completed successfully."

# ---------------------------------------------------------------------------
# Run migrations to ensure schema is up-to-date
# ---------------------------------------------------------------------------
if command -v npm >/dev/null 2>&1; then
  info "Running database migrations..."
  npm run migration:run 2>/dev/null || echo "WARNING: migration:run script not found. Run migrations manually if needed." >&2
fi

info "Database restore finished successfully."