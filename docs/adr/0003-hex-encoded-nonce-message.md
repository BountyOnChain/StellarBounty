# ADR 0003: Hex-Encoded Nonce Message

**Date:** 2026-07-20

**Status:** Accepted

**Author(s):** StellarBounty Team

## Context

Challenge-response authentication requires a nonce (unique, one-time value) to prevent replay attacks. The nonce must be transmitted to the client, embedded in a signing request, and verified on the backend. We must decide on the nonce format and encoding.

## Decision

Nonces are generated as random bytes and encoded as hexadecimal strings for transport. This allows reliable transmission across JSON APIs and Stellar transaction payloads without encoding ambiguity.

## Rationale

1. **Deterministic Encoding**: Hex is language-agnostic and decodes unambiguously.
2. **JSON Compatibility**: Hex strings fit naturally in JSON payloads and smart contract data.
3. **Stellar Compatibility**: Soroban and the Stellar SDK use hex for byte arrays.
4. **Auditability**: Hex-encoded values are human-readable for debugging.

## Consequences

- Nonces are twice as long in storage (due to hex encoding overhead).
- Client libraries must decode hex before signing (handled by Stellar SDK).
- Backend validation must encode the signed message and compare hex strings.
- No loss of security; hex encoding is transparent to HMAC/signature verification.

## References

- `apps/backend/src/auth/dto/challenge-query.dto.ts`: Challenge DTO with nonce.
- `apps/backend/src/auth/auth.service.ts`: Nonce generation and verification logic.
- [Stellar Transaction Signing](https://developers.stellar.org/docs/build-apps/write-transactions)
