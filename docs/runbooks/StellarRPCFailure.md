# Runbook: StellarRPCFailure

## Alert

- **Name:** `StellarRPCFailure`
- **Trigger:** Stellar Soroban RPC failure rate >10% over 5 minutes, sustained for 2m
- **Severity:** critical
- **Team:** blockchain

## Summary

Calls to the Soroban RPC endpoint (testnet or mainnet) are failing at
greater than 10%. Bounty on-chain operations (create / approve /
release funds) cannot complete. The HTTP service is still up; only
on-chain paths are broken.

## Impact

- Bounty creators cannot lock funds on-chain
- Approved submissions cannot be paid out
- The whole marketplace is effectively halted for on-chain flows

## Triage (first 10 minutes)

1. Confirm network: `STELLAR_NETWORK` in env
   (`testnet` vs `mainnet`).
2. Check the upstream RPC provider status page.
3. Probe directly from the host:
   `curl -fsS -m 5 "$STELLAR_RPC_URL" -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'`
4. Inspect retry metrics — `stellar_bounty_stellar_rpc_retries_total`
   should spike in tandem.

## Mitigation

- **Provider outage:** set `STELLAR_RPC_URL` to a backup node. Restart
  backend containers.
- **DNS:** verify `dig +short $STELLAR_RPC_URL_HOSTNAME`.
- **Rate-limiting:** reduce parallel subgraph writes; back off and
  retry gracefully (already implemented in `stellar-rpc-retry.ts`).

## Post-incident

- File an issue against the upstream RPC provider.
- Add a health-check for the backup node in `health.service.ts`.
- Consider a multi-RPC failover middleware (issue backlog).

## Related

- `apps/backend/src/common/stellar-rpc-client.ts`
- `apps/backend/src/common/stellar-rpc-retry.ts`
- `apps/backend/src/health/health.service.ts`
- `docs/metrics.md`
