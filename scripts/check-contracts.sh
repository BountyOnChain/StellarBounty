#!/usr/bin/env bash
#
# Local contracts pre-push gate. Mirrors the CI Contracts job:
#   1. cargo fmt --check
#   2. cargo clippy --all-targets -- -D warnings
#   3. cargo test
#
# Usage:   scripts/check-contracts.sh
# Exits non-zero on the first failing step.
#
# Required toolchain: see apps/contracts/rust-toolchain.toml — the pin
# provides the channel, components, and target automatically.
#
# Note: execute this script directly (`./scripts/check-contracts.sh`).
# Sourcing it would resolve SCRIPT_DIR relative to the caller and behave
# unexpectedly.

set -euo pipefail

# Resolve repo root from this script's location, then cd into the contracts crate.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTRACTS_DIR="$REPO_ROOT/apps/contracts"

if [[ ! -d "$CONTRACTS_DIR" ]]; then
  echo "error: contracts crate not found at $CONTRACTS_DIR" >&2
  exit 1
fi

cd "$CONTRACTS_DIR"

echo "==> toolchain: $(rustc --version) | $(cargo --version)"
echo "==> workspace: $CONTRACTS_DIR"

run_step() {
  echo "==> $*"
  "$@"
  echo "✓ $*"
}

run_step cargo fmt --check
run_step cargo clippy --all-targets -- -D warnings
run_step cargo test

echo "==> contracts gate passed"
