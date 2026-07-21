#!/usr/bin/env bash
#
# migration-dump.sh — Run all migrations against the configured database,
# then dump the resulting schema to schema.dump.
#
# Usage:
#   DATABASE_URL=postgresql://... ./scripts/migration-dump.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCHEMA_DUMP="$REPO_ROOT/schema.dump"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set."
  exit 1
fi

echo "Building backend..."
cd "$REPO_ROOT"
npm run build --workspace=apps/backend

echo "Running migrations..."
npx typeorm migration:run -d apps/backend/dist/data-source.js

echo "Dumping schema to schema.dump..."
pg_dump --schema-only --no-owner --no-privileges --no-comments "$DATABASE_URL" > "$SCHEMA_DUMP"

echo "✓ Schema dumped to schema.dump"
echo "  Review the changes and commit the updated file."
