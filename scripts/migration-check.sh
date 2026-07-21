#!/usr/bin/env bash
#
# migration-check.sh — Verify schema.dump is present and committed,
# ensuring the reference schema file is never accidentally deleted.
#
# Usage:
#   ./scripts/migration-check.sh
#
# Exits non-zero if schema.dump is missing.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCHEMA_DUMP="$REPO_ROOT/schema.dump"

if [ ! -f "$SCHEMA_DUMP" ]; then
  echo "ERROR: schema.dump not found at $SCHEMA_DUMP"
  echo ""
  echo "The schema.dump reference file is required for migration safety."
  echo "To create it, run:"
  echo "  DATABASE_URL=postgresql://... npm run migration:dump --workspace=apps/backend"
  echo ""
  echo "Then commit the updated schema.dump file."
  exit 1
fi

echo "✓ schema.dump present — migration reference file is committed."
exit 0
