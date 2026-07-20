# ADR 0005: Outbox vs. Inline State Sync

**Date:** 2026-07-20

**Status:** Accepted

**Author(s):** StellarBounty Team

## Context

The frontend requires up-to-date bounty and contributor data. This data lives in Soroban contracts (immutable, event-driven updates). The backend must synchronize contract state with a queryable database to enable fast, complex queries for the contributor dashboard and bounty listings.

We considered two patterns:
1. **Inline Sync**: Fetch fresh data from the contract on every query (simple, always current, high latency).
2. **Outbox Pattern**: Contracts emit events; backend consumes and denormalizes into a database (async, eventual consistency, low latency).

## Decision

Use the Outbox pattern with event-driven synchronization. Contract state changes emit events that the backend captures and processes asynchronously, updating a queryable database (PostgreSQL). Frontend queries hit the database, not the contract.

## Rationale

1. **Query Performance**: Database queries are fast; contract reads are slow and costly.
2. **User Experience**: Dashboard and listings respond quickly; users see updates within seconds.
3. **Scalability**: Database scale independently; multiple backends can consume the same events.
4. **Eventual Consistency**: Acceptable for a bounty platform; near-real-time is sufficient.
5. **Soroban RPC Limits**: Contracts have rate limits; outbox avoids hammering the RPC.

## Consequences

- Backend must monitor contract events and sync state reliably (requires event-processing infrastructure).
- Database can temporarily lag contract state (eventual consistency trade-off).
- Outbox table tracks processed events to ensure idempotency and handle failures.
- Requires careful error handling: failed syncs must not leave database in an inconsistent state.
- New events must be designed and tested as contract state changes.

## Implementation Notes

- Event consumers will be implemented as background workers or webhooks triggered by Soroban events.
- Outbox table tracks: event_id, contract_id, event_type, payload, processed_at.
- Idempotency key ensures events are processed exactly once, even with retries.

## References

- Closes: feat(frontend): add contributor dashboard #33
- [Outbox Pattern](https://microservices.io/patterns/data/transactional-outbox.html)
- Related: ADR 0001 (Soroban immutability)
- Backend state sync implementation (to be added)
