#!/usr/bin/env bash
#
# migration-check.sh — Verify schema.dump is present and that
# all migrations apply cleanly.
#
# Usage:
#   DATABASE_URL=postgresql://... ./scripts/migration-check.sh
#
# Exits non-zero if schema.dump is missing or migrations fail.

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
npx tsc -p apps/backend/tsconfig.json --outDir apps/backend/dist

echo "Running all migrations..."
npx typeorm migration:run -d apps/backend/dist/data-source.js

echo "Checking for pending migrations..."
SHOW_OUTPUT=$(npx typeorm migration:show -d apps/backend/dist/data-source.js 2>&1 || true)
echo "$SHOW_OUTPUT"

if echo "$SHOW_OUTPUT" | grep -qi "pending"; then
  echo ""
  echo "✗ PENDING MIGRATIONS DETECTED after running all migrations."
  echo "  This means some migrations are not being applied."
  exit 1
fi

echo ""
echo "✓ All migrations applied successfully."
exit 0
