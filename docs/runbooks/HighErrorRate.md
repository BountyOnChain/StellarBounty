# Runbook: HighErrorRate

## Alert

- **Name:** `HighErrorRate`
- **Trigger:** >5% of HTTP responses are 5xx over 5 minutes, sustained for 2m
- **Severity:** critical
- **Team:** backend

## Summary

5xx server errors are flowing to clients at greater than the 5% SLO
threshold. This usually indicates a downstream dependency outage (DB,
Soroban RPC, missing migrations, or a code regression).

## Impact

- End users see failed requests (create bounty, submit, vote, etc.)
- Frontend surfaces generic "Something went wrong" error toasts.
- Conversion to paid bounties may drop.

## Triage (first 10 minutes)

1. Check current alert payload in PagerDuty / Slack — note the
   `route` and `status_code` labels (if present).
2. Open Grafana dashboard "Stellar Bounty" — confirm error spike is
   global or scoped to one route.
3. SSH into backend host (or `docker compose logs -f backend`) and look
   for stack traces. The NestJS logger emits JSON — filter by
   `level=error`.
4. Confirm Soroban RPC reachability:
   `curl -fsS -m 5 https://soroban-testnet.stellar.org | head -n 20`
5. Confirm Postgres reachability:
   `pg_isready -h $POSTGRES_HOST -p 5432`

## Mitigation

- **Rolling deploy regression:** roll back to previous image tag via
  workflow `Deploy & Smoke Test` → `workflow_dispatch` on previous tag.
- **Downstream outage:** flip the service into "degraded but serving"
  mode by setting `STELLAR_RPC_URL` to a backup node. Document in
  #incident channel.
- **Database migration missing:** run `npm run migration:run --workspace=apps/backend`
  on the live container.

## Post-incident

- File a follow-up issue with alert payload and root cause tags.
- Add a structural test if the regression was a missing validation.
- Review runbook — update thresholds if traffic shape changed.

## Related

- `apps/backend/src/common/filters/http-exception.filter.ts`
- `docs/metrics.md`
