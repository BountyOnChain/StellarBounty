# Runbook: HighSlowQueryRate

## Alert

- **Name:** `HighSlowQueryRate`
- **Trigger:** >10% of DB queries taking >250ms over 5 minutes, sustained for 3m
- **Severity:** warning
- **Team:** backend

## Summary

A meaningful fraction of database queries are slow. Latency will be
elevated; if this persists the service may cross into
`HighDatabaseErrorRate` once connections start timing out.

## Impact

- Slow API responses (p95 elevated)
- Tail latency on bounty listing pages
- Trending toward connection-pool exhaustion

## Triage (first 10 minutes)

1. Grafana → "Database slow query share" panel.
2. Postgres top-time queries:
   `SELECT calls, mean_exec_time, query FROM pg_stat_statements
   ORDER BY mean_exec_time DESC LIMIT 20`
3. Look for missing indexes (`EXPLAIN ANALYZE` on the slowest query).
4. Check for inefficient TypeORM joins / eager loads in the recent
   commits.

## Mitigation

- **Missing index:** add an index, ship via migration, restart backend.
  The migration roundtrip test in `ci.yml` will catch schema drift.
- **Hot endpoint change:** consider adding a cache (Redis) — Outside
  the current scope; file a follow-up issue.
- **Lock contention:** identify blockers via `pg_locks`, cancel
  long-running transactions.

## Post-incident

- Add a regression test for the slow query shape.
- Add the new index lookup at the API level (don't rely on TypeORM
  auto-generation of DDL).
- Re-run `npm run migration:test --workspace=apps/backend`.

## Related

- `apps/backend/src/bounties.service.ts`
- `apps/backend/src/migrations/`
- `docs/metrics.md`
