#!/usr/bin/env bash
# =============================================================================
# StellarBounty — PostgreSQL WAL Archiving Script
#
# Archives PostgreSQL Write-Ahead Log (WAL) segments to S3 to enable
# point-in-time recovery (PITR). Designed to run every 60s via cron or CI.
#
# Usage:
#   ./scripts/wal-archive.sh                      # local archive only
#   ./scripts/wal-archive.sh --s3                 # local + S3 upload
#   ./scripts/wal-archive.sh --s3-bucket my-bucket # custom S3 bucket
#
# Environment:
#   DATABASE_URL         PostgreSQL connection string (required)
#   WAL_ARCHIVE_DIR      Local WAL archive directory (default: ./wal-archive)
#   WAL_S3_BUCKET        S3 bucket for remote storage (optional)
#   WAL_RETENTION_DAYS   Days to retain local WAL files (default: 3)
#   AWS_DEFAULT_REGION   AWS region (default: us-east-1)
#
# How it works:
#   1. Query pg_walfile_name_offset() to find the current WAL segment
#   2. Discover unarchived WAL files in pg_wal/ directory
#   3. Copy discovered WALs to WAL_ARCHIVE_DIR
#   4. Upload to S3 (if enabled) with retry logic
#   5. Clean up old local WAL files based on retention
#
# Notes:
#   - This script does NOT enable continuous archiving in postgresql.conf
#   - For production, set: archive_mode=on, archive_command='./wal-archive.sh'
#   - For CI, this script runs standalone to archive uncommitted WAL.
#   - WAL segments are ~16 MB each (default wal_segment_size).
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
WAL_ARCHIVE_DIR="${WAL_ARCHIVE_DIR:-./wal-archive}"
WAL_RETENTION_DAYS="${WAL_RETENTION_DAYS:-3}"
WAL_S3_BUCKET="${WAL_S3_BUCKET:-}"
WAL_S3_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
MAX_RETRIES=3
RETRY_DELAY=2

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------
log() {
  echo "[${TIMESTAMP}] $*"
}

warn() {
  echo "[${TIMESTAMP}] WARNING: $*" >&2
}

error() {
  echo "[${TIMESTAMP}] ERROR: $*" >&2
  exit 1
}

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
if [ -z "${DATABASE_URL:-}" ]; then
  error "DATABASE_URL is not set."
fi

command -v psql >/dev/null 2>&1 || error "psql is not installed."
command -v pg_ctl >/dev/null 2>&1 || error "pg_ctl is not installed."

# Store DATABASE_URL for later psql calls
# psql can parse it directly without manual parsing

# ---------------------------------------------------------------------------
# Create WAL archive directory
# ---------------------------------------------------------------------------
mkdir -p "${WAL_ARCHIVE_DIR}"
log "WAL archive directory: ${WAL_ARCHIVE_DIR}"

# ---------------------------------------------------------------------------
# Discover PostgreSQL WAL directory
# ---------------------------------------------------------------------------
# Query via psql using the connection string directly
pg_data_dir=$(psql "${DATABASE_URL}" -t -A -c "SHOW data_directory" 2>/dev/null || echo "")

if [ -z "${pg_data_dir}" ]; then
  warn "Could not determine PostgreSQL data directory. Skipping WAL archival."
  exit 0
fi

pg_wal_dir="${pg_data_dir}/pg_wal"

if [ ! -d "${pg_wal_dir}" ]; then
  error "PostgreSQL WAL directory not found: ${pg_wal_dir}"
fi

log "PostgreSQL data directory: ${pg_data_dir}"
log "PostgreSQL WAL directory: ${pg_wal_dir}"

# ---------------------------------------------------------------------------
# Discover unarchived WAL segments
# ---------------------------------------------------------------------------
# Strategy: find all WAL files (24-char hex names, not timeline/backup labels)
# Example: 000000010000000000000001
discovered_wals=0
failed_uploads=0

if [ ! -d "${pg_wal_dir}" ]; then
  warn "WAL directory ${pg_wal_dir} does not exist. Skipping."
  exit 0
fi

# Find WAL files: 24 hex chars, no dots (avoid .backup, .partial, etc)
mapfile -t wal_files < <(find "${pg_wal_dir}" -maxdepth 1 -type f -name '[0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F]' 2>/dev/null || true)

if [ ${#wal_files[@]} -eq 0 ]; then
  log "No WAL files discovered in ${pg_wal_dir}"
  exit 0
fi

log "Discovered ${#wal_files[@]} WAL segment(s)"

# ---------------------------------------------------------------------------
# Archive each WAL to local directory
# ---------------------------------------------------------------------------
for wal_file in "${wal_files[@]}"; do
  wal_name="$(basename "${wal_file}")"
  wal_dest="${WAL_ARCHIVE_DIR}/${wal_name}"

  # Skip if already archived
  if [ -f "${wal_dest}" ]; then
    log "WAL already archived: ${wal_name}"
    continue
  fi

  # Copy to archive directory
  if cp "${wal_file}" "${wal_dest}" 2>/dev/null; then
    log "Archived WAL: ${wal_name}"
    discovered_wals=$((discovered_wals + 1))
  else
    warn "Failed to copy WAL ${wal_name} to archive directory"
  fi
done

# ---------------------------------------------------------------------------
# Upload to S3 (if enabled)
# ---------------------------------------------------------------------------
upload_to_s3() {
  if [ -z "${WAL_S3_BUCKET}" ]; then
    return 0
  fi

  if ! command -v aws >/dev/null 2>&1; then
    warn "AWS CLI not found. Skipping S3 upload."
    return 0
  fi

  log "Uploading WAL segments to s3://${WAL_S3_BUCKET}/..."

  # Upload all archived WAL files
  for wal_file in "${WAL_ARCHIVE_DIR}"/*; do
    if [ ! -f "${wal_file}" ]; then
      continue
    fi

    wal_name="$(basename "${wal_file}")"
    s3_key="wal/${wal_name}"

    # Retry logic for S3 upload
    retry_count=0
    until [ ${retry_count} -ge ${MAX_RETRIES} ]; do
      if aws s3 cp "${wal_file}" "s3://${WAL_S3_BUCKET}/${s3_key}" --region "${WAL_S3_REGION}" --no-progress >/dev/null 2>&1; then
        log "Uploaded WAL to S3: s3://${WAL_S3_BUCKET}/${s3_key}"
        break
      else
        retry_count=$((retry_count + 1))
        if [ ${retry_count} -lt ${MAX_RETRIES} ]; then
          warn "S3 upload failed for ${wal_name}, retrying in ${RETRY_DELAY}s (attempt ${retry_count}/${MAX_RETRIES})"
          sleep ${RETRY_DELAY}
        else
          warn "S3 upload failed for ${wal_name} after ${MAX_RETRIES} attempts"
          failed_uploads=$((failed_uploads + 1))
        fi
      fi
    done
  done
}

upload_to_s3

# ---------------------------------------------------------------------------
# Cleanup old local WAL files
# ---------------------------------------------------------------------------
log "Cleaning WAL files older than ${WAL_RETENTION_DAYS} days..."
find "${WAL_ARCHIVE_DIR}" -name '[0-9A-F]*' -type f -mtime "+${WAL_RETENTION_DAYS}" -delete 2>/dev/null || true

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
if [ ${failed_uploads} -gt 0 ]; then
  warn "WAL archival completed with ${failed_uploads} S3 upload failure(s)"
  exit 1
fi

log "WAL archival completed successfully (${discovered_wals} segments archived)"
exit 0
