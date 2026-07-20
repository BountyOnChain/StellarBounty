# ADR 0001: Soroban Immutability

**Date:** 2026-07-20

**Status:** Accepted

**Author(s):** StellarBounty Team

## Context

The StellarBounty contract runs on Soroban, Stellar's smart contract platform. Soroban enforces immutability constraints on contract storage and execution. We need to establish whether we'll accept or work around these constraints in our contract design.

## Decision

We accept Soroban's immutability model and design our bounty lifecycle contracts to respect it. All storage values are immutable once written; state transitions occur through new contract invocations that create new storage entries rather than mutating existing ones.

## Rationale

1. **Security by Design**: Immutability reduces attack surface by preventing unexpected state mutations.
2. **Audibility**: Transaction history becomes a complete record of all state changes.
3. **Determinism**: Removing mutable state simplifies reasoning about contract behavior.
4. **Alignment**: Soroban's immutability model is intentional, and fighting it adds complexity.

## Consequences

- Contract state transitions are explicit: each step creates traceable entries.
- Historical records of all bounty states remain available for audit.
- Storage growth increases as we keep historical entries, requiring periodic cleanup or archival.
- New developers must understand immutable-first patterns (functional updates via new entries).

## References

- [Soroban Docs: Storage](https://developers.stellar.org/docs/smart-contracts)
- Related: ADR 0005 (Outbox pattern for state sync)
