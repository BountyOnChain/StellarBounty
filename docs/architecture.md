# Architecture

## Overview

StellarBounty is a decentralized bounty and task marketplace built on the Stellar network using Soroban smart contracts. The system consists of three main components:

- **Frontend**: Next.js 14 application for user interaction
- **Backend**: NestJS REST API for business logic and data persistence
- **Contracts**: Soroban smart contracts for on-chain escrow and payouts

## Smart Contract Architecture

### Contract Immutability

**Critical Constraint:** Soroban contracts are immutable. Once deployed, they cannot be upgraded or modified. This is a fundamental architectural limitation of the Soroban platform.

#### Implications

1. **No Upgrade Mechanism**: There is no built-in upgradeability pattern for Soroban contracts. Unlike Ethereum where proxy patterns can enable upgrades, Soroban contracts are permanently fixed after deployment.

2. **Design for Permanence**: All contract logic must be thoroughly tested and audited before deployment, as bugs cannot be fixed post-deployment.

3. **Migration Strategy**: If contract updates are required, a new contract must be deployed and users must migrate to the new contract address manually.

4. **Initialization Protection**: The current contract implements protection against re-initialization to prevent accidental state corruption (see `ContractError::AlreadyInitialized`).

#### Current Contract Design

The `EscrowContract` in `apps/contracts/src/lib.rs` is designed with immutability in mind:

- **Single Initialization**: The `initialize` function can only be called once per contract instance
- **Fixed Parameters**: Owner, amount, token address, arbitrator, and timelock duration are set at initialization and cannot be changed
- **No Admin Functions**: There are no administrative functions that could modify contract behavior post-deployment
- **Time-locked Operations**: Critical operations (approve, cancel, resolve) use a timelock mechanism to provide safety while maintaining immutability

#### Testing Considerations

The contract includes comprehensive test coverage, including:
- `test_reinitialize_after_deploy_errs_to_protect_upgrade_state`: Verifies that contracts cannot be re-initialized after deployment
- Full lifecycle testing for all bounty states
- Edge case handling for unauthorized access attempts

### Contract State Machine

The bounty contract follows a strict state machine:

```
Created → Funded → InProgress → UnderReview → Completed
                ↓                 ↓
              Cancelled         Disputed → Completed
```

Each state transition is protected by authorization checks and status validation.

## Backend Architecture

The NestJS backend provides:

- REST API endpoints for frontend integration
- PostgreSQL database for off-chain data persistence
- JWT-based authentication
- Integration with Stellar network for contract interactions

## Frontend Architecture

The Next.js frontend provides:

- User interface for bounty creation and management
- Integration with backend API
- Stellar wallet integration for on-chain interactions

## Security Considerations

1. **Contract Immutability**: No upgrade mechanism means thorough testing is essential
2. **Time-lock Operations**: Critical operations are time-locked to prevent rushed decisions
3. **Authorization**: All state changes require proper authorization from relevant parties
4. **Arbitration**: Dispute resolution mechanism built into contract logic

## Reliability Considerations

### Nonce TTL Configuration

**Constraint:** The authentication nonce TTL is hardcoded to 5 minutes (300,000ms) by default in `apps/backend/src/auth/auth.service.ts`.

#### Implementation Details

- **Default Value**: 300,000ms (5 minutes) - see line 23 of `auth.service.ts`
- **Configuration**: Can be overridden via `AUTH_NONCE_TTL_MS` environment variable
- **Usage**: Nonces are used for Stellar wallet challenge-response authentication
- **Cleanup**: Expired nonces are automatically pruned via `pruneExpired()` method

#### Reliability Implications

1. **Short Window**: 5 minutes may be insufficient for users with slow network connections or complex signing workflows
2. **User Experience**: Failed authentication due to nonce expiration can frustrate users
3. **Network Latency**: Users in regions with poor connectivity may experience timeouts
4. **Mobile Wallets**: Some mobile wallet implementations may have delays in signing operations

#### Recommendations

- **Environment Configuration**: Always set `AUTH_NONCE_TTL_MS` explicitly in production environments
- **Monitoring**: Track nonce expiration rates to identify if users are experiencing timeouts
- **User Communication**: Provide clear error messages when nonce expiration occurs
- **Testing**: Test authentication flows with various network conditions and wallet implementations
- **Consider Longer TTL**: For production deployments, consider increasing to 10-15 minutes to accommodate edge cases
