# Contract Events — On-Chain Event Schema

This document describes the events emitted by the StellarBounty Soroban contracts.

## Symbol Short Storage Keys

Contracts use short symbol keys for event topics. Indexers SHOULD normalize these.

## Event Schema

| Event | Symbol Topic | Payload |
|-------|-------------|---------|
| bounty_created | `bounty_create` | `{bounty_id, owner, title, reward, deadline}` |
| submission_created | `submission_new` | `{bounty_id, contributor, artifact_ref}` |
| bounty_funded | `bounty_fund` | `{bounty_id, amount}` |
| bounty_completed | `bounty_complete` | `{bounty_id, winner, payout_tx}` |

## Indexer Notes

- Emitted events are final; there is no revoke event.
- Use `symbol_short!` as primary discriminator.
- Replay from ledger start to rebuild state.
