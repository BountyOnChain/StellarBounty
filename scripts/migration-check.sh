#!/usr/bin/env bash
#
# migration-check.sh — Compare the schema produced by running all migrations
# against the committed reference dump (schema.dump).
#
# Usage:
#   DATABASE_URL=postgresql://... ./scripts/migration-check.sh
#
# Exits non-zero if:
#   - schema.dump is missing
#   - migrations produce a schema that differs from schema.dump

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

echo "Running migrations to build schema..."
cd "$REPO_ROOT"
npx tsc -p apps/backend/tsconfig.json --outDir apps/backend/dist

# Run migrations via TypeORM DataSource
node apps/backend/dist/data-source.js 2>/dev/null || true

# Use TypeORM's migration:run through the CLI
npx typeorm migration:run -d apps/backend/dist/data-source.js

echo "Dumping schema from database..."
# Extract just the schema (no data) using pg_dump
PGDUMP_OUTPUT=$(pg_dump --schema-only --no-owner --no-privileges --no-comments "$DATABASE_URL" 2>/dev/null)

# Normalize: remove volatile lines (timestamps, OIDs, owner comments, SET statements)
NORMALIZED=$(echo "$PGDUMP_OUTPUT" | \
  grep -v '^--' | \
  grep -v '^SET ' | \
  grep -v '^SELECT pg_catalog' | \
  grep -v 'owner to' | \
  grep -v '^$' | \
  sort)

# Read and normalize the committed schema.dump
EXPECTED_NORMALIZED=$(cat "$SCHEMA_DUMP" | \
  grep -v '^--' | \
  grep -v '^SET ' | \
  grep -v '^SELECT pg_catalog' | \
  grep -v 'owner to' | \
  grep -v '^$' | \
  sort)

echo "Comparing schemas..."
if [ "$NORMALIZED" = "$EXPECTED_NORMALIZED" ]; then
  echo "✓ Schema matches schema.dump — no drift detected."
  exit 0
else
  echo ""
  echo "✗ SCHEMA DRIFT DETECTED"
  echo ""
  echo "The database schema produced by running all migrations differs from"
  echo "the committed schema.dump file. This usually means a migration was"
  echo "run locally without committing the updated schema.dump."
  echo ""
  echo "To fix:"
  echo "  1. Run 'npm run migration:dump --workspace=apps/backend' to regenerate schema.dump"
  echo "  2. Commit the updated schema.dump file"
  echo ""
  diff --un=3 <(echo "$EXPECTED_NORMALIZED") <(echo "$NORMALIZED") || true
  exit 1
fi
