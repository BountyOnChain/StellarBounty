#!/usr/bin/env bash
#
# migration-check.sh — Verify schema.dump is present and the database
# schema is in sync with the entities (no pending migrations needed).
#
# Usage:
#   DATABASE_URL=postgresql://... ./scripts/migration-check.sh
#
# Exits non-zero if schema.dump is missing or schema is out of sync.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCHEMA_DUMP="$REPO_ROOT/schema.dump"

if [ ! -f "$SCHEMA_DUMP" ]; then
  echo "ERROR: schema.dump not found at $SCHEMA_DUMP"
  echo "Run 'npm run migration:dump --workspace=apps/backend' to create it."
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set."
  exit 1
fi

cd "$REPO_ROOT"

echo "Building backend..."
npm run build --workspace=apps/backend

echo "Running migrations..."
npm run migration:run --workspace=apps/backend

echo "Verifying schema is up to date (no ungenerated migrations)..."
cd apps/backend
npx typeorm migration:generate -d dist/data-source.js --check dummy 2>&1
RESULT=$?
cd "$REPO_ROOT"

if [ "$RESULT" -ne 0 ]; then
  echo ""
  echo "✗ SCHEMA DRIFT DETECTED"
  echo ""
  echo "The database schema is out of sync with the entities."
  echo "This usually means a migration was added or modified without"
  echo "being properly applied."
  echo ""
  echo "To fix:"
  echo "  1. Run 'npm run migration:run --workspace=apps/backend'"
  echo "  2. Run 'npm run migration:dump --workspace=apps/backend'"
  echo "  3. Commit the updated migration files and schema.dump"
  exit 1
fi

echo "✓ Schema is in sync — no drift detected."
exit 0
