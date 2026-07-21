# Runbook: HighLatency

## Alert

- **Name:** `HighLatency`
- **Trigger:** p95 HTTP latency >2s over 5 minutes, sustained for 3m
- **Severity:** warning
- **Team:** backend

## Summary

The p95 API latency has exceeded 2 seconds. The frontend will feel
sluggish; users may abandon flows.

## Impact

- Slow bounty listing pages
- Submit/claim actions feel unresponsive
- Possible timeout-related 5xx errors following this alert

## Triage (first 10 minutes)

1. Open Grafana "Stellar Bounty" → Latency panel. Sort by route to
   identify the offender.
2. Check if correlated with `HighDatabaseErrorRate` or
   `HighSlowQueryRate` — DB is the usual cause.
3. Inspect DB: `pg_stat_activity` (active queries) and
   `pg_stat_statements` (top mean-time statements).
4. Inspect Soroban RPC: recent latency stats on the metrics dashboard.
5. Confirm deploys: was a new version just rolled out?

## Mitigation

- **DB at fault:** identify and kill stuck queries
  (`SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE
  query_start < NOW() - INTERVAL '5 minutes'`).
- **Hot endpoint:** enable temporary response compression via `gzip`
  off the load balancer; cache top-N bounty listing at the gateway.
- **Code regression:** roll back via `Deploy & Smoke Test` workflow.

## Post-incident

- Add an SLO entry if this represents a new normal floor (e.g., added
  an RPC roundtrip that raised baseline latency).
- File issue to add an index, cache, or batch RPC.

## Related

- `apps/backend/src/bounties.controller.ts`
- `apps/backend/src/metrics/metrics.middleware.ts`
- `docs/metrics.md`
