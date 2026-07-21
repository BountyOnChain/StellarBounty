#!/usr/bin/env bash
#
# Post-deploy smoke test for the StellarBounty stack.
#
# Probes the deployed services to verify the application is reachable and
# reports its own health. Used by .github/workflows/deploy.yml after a
# release has been deployed.
#
# Exit codes:
#   0  stack is healthy     (status: ok)
#   0  stack is degraded    (status: degraded) — log a warning, pass
#   1  connectivity / probe failed after all retries
#
# Required env (override any):
#   BACKEND_URL             default: http://localhost:4000
#   FRONTEND_URL            default: http://localhost:3000
#   SMOKE_TIMEOUT_SECONDS   default: 5
#   SMOKE_RETRIES           default: 6
#   SMOKE_BACKOFF_SECONDS   default: 10
#
# Behaviour:
#   * Uses curl with --max-time per attempt to fail fast.
#   * Retries with exponential-ish backoff (linear with caps).
#   * Tolerates status=ok AND status=degraded (degraded is a yellow flag,
#     not a CI failure — downstream RPC / DB flakiness should not block
#     deployment).
#   * Treats as FAILURE: status=down, non-200 HTTP, malformed body, or
#     exhausted retries.
#
# Usage:
#   ./scripts/smoke-test.sh
#
# Note: execute this script directly. Sourcing would resolve SCRIPT_DIR
# relative to the caller and behave unexpectedly.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

BACKEND_URL="${BACKEND_URL:-http://localhost:4000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
SMOKE_TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS:-5}"
SMOKE_RETRIES="${SMOKE_RETRIES:-6}"
SMOKE_BACKOFF_SECONDS="${SMOKE_BACKOFF_SECONDS:-10}"
# /api/v1 is the global NestJS prefix (see apps/backend/src/main.ts).
HEALTH_PATH="/api/v1/health"

log() { printf '[smoke-test] %s\n' "$*"; }

probe_backend() {
  local attempt="$1"
  local url="${BACKEND_URL}${HEALTH_PATH}"
  local response status_code body

  log "probe attempt ${attempt}/${SMOKE_RETRIES} — ${url}"

  response="$(curl --silent --show-error --max-time "${SMOKE_TIMEOUT_SECONDS}" \
    --write-out '\nHTTP_STATUS:%{http_code}' "${url}" 2>/dev/null || true)"

  if [[ -z "${response}" ]]; then
    log "  no response (curl failed or timed out after ${SMOKE_TIMEOUT_SECONDS}s)"
    return 2
  fi

  status_code="$(printf '%s' "${response}" | sed -n 's/^HTTP_STATUS://p' | tail -n1)"
  body="$(printf '%s' "${response}" | sed '/^HTTP_STATUS:/d')"

  if [[ -z "${status_code}" || "${status_code}" != "200" ]]; then
    log "  unexpected HTTP status: ${status_code:-<empty>}"
    return 3
  fi

  local status
  status="$(printf '%s' "${body}" | grep -oE '"status"[[:space:]]*:[[:space:]]*"[^"]+"' | head -n1 \
    | sed -E 's/.*"status"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"

  case "${status}" in
    ok)
      log "  backend reports status=ok — healthy"
      return 0
      ;;
    # Tolerate `degraded` so a flaky downstream (RPC, DB flakiness)
    # doesn't block deployment on its own. The independent
    # `StellarRPCFailure` / `HighDatabaseErrorRate` alerts (issue #428)
    # own the page-ability of those conditions.
    degraded)
      log "  backend reports status=degraded — proceeding with warning"
      return 0
      ;;
    down)
      log "  backend reports status=down — failing"
      return 1
      ;;
    *)
      log "  backend response missing/invalid status field — failing"
      log "  body: ${body}"
      return 1
      ;;
  esac
}

probe_frontend() {
  local attempt="$1"
  local url="${FRONTEND_URL}/"
  local status_code

  log "probe attempt ${attempt}/${SMOKE_RETRIES} — ${url}"

  status_code="$(curl --silent --show-error --max-time "${SMOKE_TIMEOUT_SECONDS}" \
    --output /dev/null --write-out '%{http_code}' "${url}" 2>/dev/null || true)"

  if [[ -z "${status_code}" || "${status_code}" != "200" && "${status_code}" != "301" && "${status_code}" != "302" ]]; then
    log "  frontend not reachable on HTTP ${status_code:-<empty>}"
    return 1
  fi

  log "  frontend reachable (HTTP ${status_code})"
  return 0
}

run_with_retries() {
  local label="$1"
  shift
  local probe_fn="$1"
  shift

  local attempts=0
  local backoff="${SMOKE_BACKOFF_SECONDS}"

  while (( attempts < SMOKE_RETRIES )); do
    attempts=$(( attempts + 1 ))

    if "${probe_fn}" "${attempts}"; then
      log "${label} OK after ${attempts} attempt(s)"
      return 0
    fi

    if (( attempts < SMOKE_RETRIES )); then
      log "${label} not ready — sleeping ${backoff}s before retry"
      sleep "${backoff}"
      # Cap backoff at 60s; never grow forever.
      if (( backoff < 60 )); then
        backoff=$(( backoff + 5 ))
      fi
    fi
  done

  log "${label} FAILED after ${SMOKE_RETRIES} attempts"
  return 1
}

main() {
  log "starting smoke tests"
  log "backend:  ${BACKEND_URL}"
  log "frontend: ${FRONTEND_URL}"
  log "retries:  ${SMOKE_RETRIES}, timeout: ${SMOKE_TIMEOUT_SECONDS}s, backoff: ${SMOKE_BACKOFF_SECONDS}s"
  log "repo:     ${REPO_ROOT}"

  local overall=0

  if ! run_with_retries "backend health" probe_backend; then
    overall=1
  fi

  if ! run_with_retries "frontend reachability" probe_frontend; then
    overall=1
  fi

  if (( overall == 0 )); then
    log "ALL SMOKE TESTS PASSED ✅"
    exit 0
  fi

  log "ONE OR MORE SMOKE TESTS FAILED ❌"
  exit 1
}

main "$@"
