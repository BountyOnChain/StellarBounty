# Runbook: HighDatabaseErrorRate

## Alert

- **Name:** `HighDatabaseErrorRate`
- **Trigger:** >10% of DB queries failing over 5 minutes, sustained for 2m
- **Severity:** critical
- **Team:** backend

## Summary

More than one-in-ten DB queries is failing. Almost certainly the
service is in a degraded-write or degraded-read state and may burst
into a full outage.

## Impact

- Backend may be returning 500s for write paths (bounty creation,
  submission, vote) even though HTTP is still up.
- `node-postgres` connection pool may be saturated by retries.

## Triage (first 10 minutes)

1. Open Grafana → "Database" panel. Note which `operation` is failing.
2. Confirm Postgres reachability:
   `pg_isready -h $POSTGRES_HOST -p 5432`
3. If reachable, look at active backends and locks:
   `SELECT count(*), state, wait_event_type FROM pg_stat_activity
   GROUP BY state, wait_event_type`
4. Check disk and WAL on Postgres host:
   `df -h /var/lib/postgresql` and replications slot lag.
5. Tail backend logs filtered to `database`:

   ```bash
   docker compose logs -f backend | grep -i 'database'
   ```

## Mitigation

- **DB host down:** page DBA / infra. Users get full outage until
  Postgres is back; backups unaffected (verified daily by
  `backup-verify.yml`).
- **Connection pool exhausted:** restart backend containers to free
  pooled connections:
  `docker compose restart backend`
- **Long-running migration stuck:** check `pg_locks` for
  `transactionid` waiters; cancel the migration query and rerun.

## Post-incident

- Add a load test scenario that reproduces the traffic shape (if
  load-related).
- Update connection pool sizing if exhaustion-not-down was the cause.
- Verify backup restore still works (`backup-verify.yml`).

## Related

- `apps/backend/src/db-pool.config.ts`
- `docs/operations.md` — Disaster Recovery Procedure
- `docs/metrics.md`
