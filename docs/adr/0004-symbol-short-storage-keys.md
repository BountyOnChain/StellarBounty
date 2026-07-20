# ADR 0004: Symbol-Short Storage Keys

**Date:** 2026-07-20

**Status:** Accepted

**Author(s):** StellarBounty Team

## Context

Soroban contracts store data in a key-value ledger. Keys consume space on the Stellar ledger, and storage is metered. We must choose between human-readable string keys and compact symbol keys to optimize storage efficiency.

## Decision

Use Soroban Symbol type for storage keys in contract data structures. Keys are kept as short as practical while remaining unambiguous (e.g., `bounty_id`, `issuer`, `status`). This provides both readability and ledger-space efficiency.

## Rationale

1. **Ledger Efficiency**: Symbols are compact and directly supported by Soroban.
2. **Code Clarity**: Short, semantic symbols remain readable and self-documenting.
3. **Stellar Native**: Symbol keys are the recommended practice in Soroban patterns.
4. **Future-Proof**: Minimizing key size leaves room for contract growth.

## Consequences

- Storage keys must be carefully named to avoid conflicts and maintain clarity.
- Debugging requires a key reference guide; logs should map symbols to meanings.
- Migration of keys is complex and must be planned carefully.
- New team members must learn the symbol-to-attribute mapping for the contract.

## References

- [Soroban Storage Docs](https://developers.stellar.org/docs/smart-contracts)
- Contract implementation in `apps/contracts/` (once created)
- Related: ADR 0001 (Soroban immutability)
