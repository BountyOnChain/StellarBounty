# ADR 0002: JWT Key Model

**Date:** 2026-07-20

**Status:** Accepted

**Author(s):** StellarBounty Team

## Context

Authentication uses JSON Web Tokens (JWT) to issue and validate user sessions. We must decide on a key management strategy: single long-lived secret, rotating secrets, or public/private keypairs.

Currently, we use a single JWT secret. However, this approach doesn't allow rotation without invalidating all outstanding tokens. Future work will introduce a key rotation strategy as part of the bounty lifecycle state machine contract enhancements.

## Decision

**Phase 1 (Current)**: Use a single long-lived JWT secret stored in environment variables.

**Phase 2 (Future)**: Implement key rotation as part of feat(contracts): bounty lifecycle state machine + unit tests #27, introducing versioned keys with automatic fallback to previous keys during rotation windows.

## Rationale

1. **Simplicity**: A single secret minimizes initial complexity and operational overhead.
2. **Security Sufficient for MVP**: Single key is acceptable for early-stage deployment.
3. **Planned Migration Path**: Rotation strategy is deferred but architecturally compatible.
4. **Reduce Scope**: Keeping key rotation out of authentication MVP keeps delivery focused.

## Consequences

- All users logged out when the secret is changed (unavoidable in Phase 1).
- Future rotation work must maintain backward compatibility with issued tokens.
- Environment variable must be kept secure (treated as a critical secret).
- Phase 2 will require versioning JWT headers and validation logic changes.

## References

- `apps/backend/src/auth/get-jwt-secret.ts`: JWT secret retrieval logic.
- Planned feature: feat(contracts): bounty lifecycle state machine + unit tests #27
- Related: ADR 0004 (Hex-encoded nonce message)
