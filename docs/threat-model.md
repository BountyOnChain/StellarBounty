# Threat Model — StellarBounty

Scope: public bounty platform on Stellar (frontend, backend API, Soroban contracts).

Author: community contributor
Status: draft

## STRIDE

| Threat | Target | Mitigation |
|--------|--------|------------|
| Spoofing | JWT/auth, submission ownership | Strong JWT, exp, refresh rotation, signature verification on submission ownership transfers. |
| Tampering | bounty payload, status transitions | Server-side enforcement of state machine, signed submission actions, DB transaction integrity. |
| Repudiation | audit trail, payout events | Append-only audit log, on-chain transaction IDs, immutable event schema. |
| Information Disclosure | PII in auth, payout records | Do not log secrets, redact email/payout in telemetry, env-based secret management. |
| Denial of Service | RPC, submission flood | Rate limit auth, pagination, Redis cache hot bounties, connection pooling. |
| Elevation of Privilege | role escalation | JWT role claim validated against DB session; contributors cannot promote themselves to owner/builder. |
