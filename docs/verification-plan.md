# Verification Plan: StellarBounty Escrow Contract

**Date:** 2026-07-20  
**Status:** In Progress  
**Owner:** StellarBounty Team

---

## Executive Summary

The StellarBounty bounty escrow contract manages custody of tokens and orchestrates payouts through a formal state machine. This verification plan establishes a path to formal verification of the contract's core invariants using Soroban-compatible tools. Formal verification will provide auditors and users with mathematical proof that the contract cannot leak funds or violate state machine properties.

---

## 1. Abstract State Machine Model

### 1.1 States

The contract implements a bounty lifecycle with seven states:

| State | Description | Transitions To |
|-------|-------------|-----------------|
| **Created** | Bounty initialized; not yet funded | Funded, Cancelled |
| **Funded** | Tokens escrowed in contract; ready for work | InProgress, Cancelled |
| **InProgress** | Contributor actively working | UnderReview |
| **UnderReview** | Work submitted; awaiting owner review | Completed (via approve), Disputed |
| **Disputed** | Disagreement over work quality; arbitration needed | Completed (via resolve) |
| **Completed** | Funds paid out to winner; terminal state | — |
| **Cancelled** | Bounty abandoned; refund processed; terminal state | — |

### 1.2 Roles and Permissions

- **Owner**: Initiates bounty, funds it, approves work or disputes, can rotate arbitrator
- **Contributor**: Starts work, submits deliverables, can dispute at UnderReview
- **Arbitrator**: Resolves disputes by selecting winner (owner or contributor)

### 1.3 Key Data

| Data | Type | Mutability | Lifecycle |
|------|------|-----------|-----------|
| `owner` | Address | Immutable | Set at initialize |
| `amount` | i128 | Immutable | Set at initialize |
| `token_address` | Address | Immutable | Set at initialize |
| `arbitrator` | Address | Mutable | Initialized; can rotate via `rotate_arbitrator` |
| `contributor` | Address | Written once | Set at `start_work` |
| `status` | BountyStatus | Mutable | Transitioned via state machine |
| `pending_operation` | Optional<TimelockOperation> | Mutable | Queued/cleared for time-locked actions |

### 1.4 Time-Locking

Critical operations (approve, cancel, resolve) are time-locked for safety:
1. Initiator calls `approve()`, `cancel()`, or `resolve()`
2. Operation is queued with `unlock_at = now + timelock_duration` (default 24 hours)
3. After time elapses, executor calls `execute_*()` to complete
4. Initiator can cancel queued operation before unlock

---

## 2. Invariants to Verify

### 2.1 Fund Conservation (Critical)

**Invariant**: Total tokens in contract ≤ amount at all times. Funds only leave via:
- Approved payment to contributor at UnderReview → Completed
- Cancelled refund to owner at Funded → Cancelled or Created → Cancelled
- Disputed resolution payout at Disputed → Completed

**Formalization**:
```
balance(contract) ∈ {0, amount}
- At Created or Funded: balance == amount
- At InProgress or UnderReview: balance == amount
- At Disputed: balance == amount
- At Completed or Cancelled: balance == 0
```

**Why it matters**: Prevents double-spending, fund loss, or unauthorized transfers.

### 2.2 State Machine Validity (Critical)

**Invariant**: Transitions only occur via valid paths. Invalid transitions are rejected.

**Formalization**:
```
Created  → {Funded, Cancelled}
Funded   → {InProgress, Cancelled}
InProgress → {UnderReview}
UnderReview → {Completed, Disputed}
Disputed → {Completed}
Terminal states: {Completed, Cancelled} (no outgoing edges)
```

**Why it matters**: Prevents status corruption, replaying transitions, or reaching inconsistent states.

### 2.3 Authorization (Critical)

**Invariant**: Only authorized roles can trigger state transitions.

**Formalization**:
```
initialize(owner, ...) requires owner auth
fund(owner) requires owner auth
start_work(contributor) requires contributor auth
submit(contributor) requires contributor auth
approve(owner) requires owner auth (queued)
execute_approve() requires pending operation
cancel(owner) requires owner auth (queued, from Created or Funded only)
execute_cancel() requires pending operation
dispute(caller) requires caller auth (caller ∈ {owner, contributor})
resolve(arbitrator, winner) requires arbitrator auth (queued)
execute_resolve() requires pending operation
rotate_arbitrator(owner, new_arb) requires owner auth
cancel_operation(caller) requires caller auth (caller == initiator)
```

**Why it matters**: Prevents unauthorized fund access or state manipulation.

### 2.4 Single Initialization (Critical)

**Invariant**: Contract can only be initialized once. Subsequent calls to `initialize` are rejected.

**Formalization**:
```
After initialize(...) succeeds, any subsequent initialize(...) returns AlreadyInitialized
```

**Why it matters**: Prevents contract re-initialization attacks (due to immutability constraint ADR-0001).

### 2.5 Pending Operation Uniqueness

**Invariant**: At most one operation can be queued at a time.

**Formalization**:
```
pending_operation can be None or Some(op), not multiple
queue_operation fails if pending_operation ≠ None
execute_* and cancel_operation clear pending after execution
```

**Why it matters**: Prevents operation queue corruption or multiple simultaneous timelock expirations.

### 2.6 Timelock Integrity

**Invariant**: Operations must wait for the full timelock duration before execution.

**Formalization**:
```
execute_* requires current_timestamp ≥ unlock_at
cancel_operation requires current_timestamp < unlock_at
```

**Why it matters**: Ensures safety window for reviewing operations before irreversible execution.

### 2.7 Winner Validity in Dispute Resolution

**Invariant**: Only owner or contributor can be selected as dispute winner.

**Formalization**:
```
resolve(arbitrator, winner) requires winner ∈ {owner, contributor}
```

**Why it matters**: Prevents arbitrator from redirecting funds to arbitrary addresses.

---

## 3. Invariant-Violating Attack Scenarios

These scenarios should **fail** verification or be **prevented** by controls:

1. **Double-spend**: Owner calls approve and cancel simultaneously → Prevented by pending_operation uniqueness
2. **Lost funds**: Tokens transferred from contract without matching status → Prevented by fund conservation
3. **State bypass**: Transition from Funded directly to Completed → Prevented by state machine validation
4. **Unauthorized transfer**: Non-owner calls approve → Prevented by authorization checks
5. **Re-initialization**: After deploy, re-init with new owner/amount → Prevented by AlreadyInitialized check
6. **Timelock bypass**: execute_approve called before unlock_at → Prevented by timelock check
7. **Arbitrator hijack**: Non-arbitrator calls resolve → Prevented by arbitrator auth
8. **Winner hijack**: Dispute resolves to neither owner nor contributor → Prevented by InvalidWinner check

---

## 4. Tool Selection and Rationale

### 4.1 Candidate Tools

| Tool | Language | Approach | Soroban Support | Maturity | Selected? |
|------|----------|----------|-----------------|----------|-----------|
| **Kani** | Rust | Bounded model checker | Via soroban-sdk verification mode | Experimental | Phase 2 |
| **Certora** | Spec language | Symbolic execution | No direct support; Soroban SDK gaps | Mature | Phase 2 |
| **Mythril** | EVM bytecode | Symbolic execution | Not applicable | Mature | No |
| **Runtime Testing + Audit** | Rust | Concrete execution | Native support | N/A | Phase 1 ✓ |

### 4.2 Phased Approach

**Phase 1 (Current)**: Property-based testing + manual audit
- Exhaustive runtime testing via Rust tests
- Manual code review and invariant inspection
- Integration tests covering all state transitions
- No external formal verification tool required
- **Timeline**: Complete by contract audit (pre-mainnet)

**Phase 2 (Future)**: Bounded model checking with Kani
- Leverage Soroban verification mode to check critical paths
- Verify fund conservation under all possible input combinations
- Verify state machine completeness
- **Timeline**: Post-mainnet, if audit finds gaps

**Phase 3 (Future)**: Advanced symbolic execution
- Certora formal specifications if Soroban SDK support matures
- Complex multi-contract interactions (if needed)
- **Timeline**: If expanding to multi-contract bounty systems

### 4.3 Rationale for Phase 1 Focus

1. **Soroban Tools Maturity**: Formal verification for Soroban is still evolving; external tools (Certora, Mythril) lack Soroban support.
2. **Contract Simplicity**: The escrow contract is self-contained and linear; bounded scenarios can be exhaustively tested.
3. **Time-to-Market**: Phase 1 verification is achievable pre-mainnet; waiting for tool maturity could delay launch.
4. **Audit Alignment**: Professional auditors will manually verify invariants; Phase 1 supports audit confidence.
5. **Incremental Risk**: Phase 2 can be triggered if audit findings warrant deeper analysis.

---

## 5. Phase 1: Runtime Testing & Manual Verification

### 5.1 Testing Strategy

**Coverage Goals**:
- ✓ All state transitions (7 states × 2 outgoing edges average = ~14 paths)
- ✓ All authorization checks
- ✓ All error conditions
- ✓ Time-locking edge cases
- ✓ Fund flow paths (approve, cancel refund, dispute resolution)

**Existing Test Suite** (`apps/contracts/src/lib.rs::tests`):
- ✓ `test_initialize_stores_fields`: Initialization state
- ✓ `test_reinitialize_after_deploy_errs_to_protect_upgrade_state`: Single initialization
- ✓ `test_fund_transfers_tokens_and_transitions`: Fund conservation (Created → Funded)
- ✓ `test_approve_pays_contributor`: Fund conservation (approval path)
- ✓ `test_cancel_from_funded_refunds_owner`: Fund conservation (cancellation path)
- ✓ `test_cancel_from_created_no_transfer`: Cancellation without funds
- ✓ `test_start_work_transitions_to_in_progress`: State transition
- ✓ `test_submit_transitions_to_under_review`: State transition
- ✓ `test_dispute_by_owner_transitions_to_disputed`: Dispute handling
- ✓ `test_owner_can_rotate_arbitrator`: Arbitrator rotation
- ... and ~10 more edge case tests

**Additional Tests to Add** (Phase 1 enhancement):
- [ ] `test_dispute_resolution_pays_correct_winner`: Verify both owner and contributor can receive payout
- [ ] `test_timelock_cancellation_prevents_double_spend`: Interleaving approve and cancel
- [ ] `test_all_invalid_transitions_rejected`: Brute-force invalid state transitions
- [ ] `test_fund_conservation_across_all_paths`: Aggregate token balance verification

### 5.2 Manual Invariant Checklist

- [ ] **Fund Conservation**: Code review of all transfer points
  - Lines: `fund()` transfer_from, `execute_approve()` transfer, `execute_cancel()` conditional transfer, `execute_resolve()` transfer
  - Verify: Each transfer deducts from contract; only called in valid state
  
- [ ] **State Machine Validity**: Review all status transitions
  - Verify: No backdoor transitions; all checks enforced
  - Trace: Each function's pre/post status expectations
  
- [ ] **Authorization**: Audit all `require_auth()` and role checks
  - owner auth: initialize, fund, approve, cancel, rotate_arbitrator
  - contributor auth: start_work, submit, dispute
  - arbitrator auth: resolve
  - initiator auth: cancel_operation
  
- [ ] **Single Initialization**: Check `AlreadyInitialized` guard
  - Verify: STATUS key checked before any mutation
  
- [ ] **Pending Operation**: Review queue logic
  - Verify: Only one operation queued; cleared after execution
  - Verify: Can't queue if pending exists; can't execute/cancel without pending

### 5.3 Continuous Integration Gating

**CI Check**: `cargo test --release` passes all tests
- Location: `.github/workflows/ci.yml` (add contracts step if missing)
- **Milestone 1** (done by PR submission):
  - All existing tests pass
  - New edge case tests pass
  
- **Milestone 2** (pre-mainnet):
  - Manual invariant checklist completed and signed off
  - Audit report references invariant verifications
  - No critical findings in fund conservation or authorization

---

## 6. Phase 2: Bounded Model Checking (Future)

### 6.1 Scope

Once Soroban verification tools mature, verify:
- Fund conservation under all possible input sequences (up to N operations)
- State machine reachability (can we reach invalid states?)
- Time-locking consistency under clock manipulation

### 6.2 Tool Setup

```bash
# (Future) Install Kani for Rust
cargo install --locked kani-verifier
cargo kani

# (Future) Run with Soroban mode
SOROBAN_MODE=1 cargo kani
```

### 6.3 Verification Spec

```rust
// Pseudo-spec for fund conservation
#[kani::proof]
fn verify_fund_conservation() {
    let env = setup();
    let initial_balance = balance(&env);
    
    // Execute any valid sequence of operations
    for operation in valid_sequences() {
        operation.execute(&env);
        let balance = balance(&env);
        assert!(balance >= 0 && balance <= initial_balance);
        if is_terminal_state(&env) {
            assert!(balance == 0);
        }
    }
}
```

---

## 7. Timeline and Milestones

| Milestone | Deliverable | Target Date | Owner | Status |
|-----------|-------------|-------------|-------|--------|
| **Phase 1.1** | Manual invariant checklist completed | 2026-08-15 | Audit team | Planned |
| **Phase 1.2** | Additional edge case tests written | 2026-08-15 | Dev team | Planned |
| **Phase 1.3** | CI gate: All tests + checklist pass | 2026-08-30 | Ops | Planned |
| **Phase 1.4** | Audit report with invariant sign-off | 2026-09-15 | Auditor | Planned |
| **Phase 1.5** | Pre-mainnet deployment | 2026-09-20 | Dev team | Planned |
| **Phase 2.1** | Evaluate Soroban Kani support | 2026-Q4 | Dev team | Deferred |
| **Phase 2.2** | Implement bounded model checking | 2026-Q1 2027 | Dev team | Deferred |
| **Phase 2.3** | Publish formal verification report | 2026-Q1 2027 | Team | Deferred |

---

## 8. Success Criteria

- [ ] All tests in Phase 1.1–Phase 1.3 pass in CI
- [ ] Manual invariant checklist completed with no critical gaps
- [ ] External audit validates invariant reasoning
- [ ] Zero fund loss incidents post-mainnet
- [ ] (Phase 2) Formal tool report confirms invariants under bounded model

---

## 9. References and Resources

### Contracts and Implementation
- `apps/contracts/src/lib.rs`: Source contract with test suite
- `docs/architecture.md`: High-level bounty system architecture
- `docs/adr/0001-soroban-immutability.md`: Immutability constraint rationale

### Soroban Documentation
- [Soroban Smart Contracts](https://developers.stellar.org/docs/smart-contracts)
- [Soroban SDK Rust](https://docs.rs/soroban-sdk/latest/soroban_sdk/)
- [Soroban Contract Testing](https://developers.stellar.org/docs/smart-contracts/testing)

### Formal Methods
- [Kani Verifier](https://github.com/model-checking/kani) - Bounded model checking for Rust
- [Certora Prover](https://www.certora.com/) - Symbolic execution (EVM-focused; Soroban support TBD)
- [Property-Based Testing](https://hypothesis.works/) - Exhaustive scenario generation

### Related ADRs
- ADR 0001: Soroban Immutability (design rationale)
- ADR 0005: Outbox Pattern (state sync implications)

---

## 10. Appendix: Manual Invariant Verification Checklist

Use this checklist during code review and pre-audit:

### Fund Conservation
- [ ] `fund()` transfers exact amount from owner to contract
- [ ] `execute_approve()` transfers exact amount from contract to contributor only if status is UnderReview
- [ ] `execute_cancel()` transfers exact amount to owner only if status is Created or Funded
- [ ] `execute_resolve()` transfers exact amount to selected winner only if status is Disputed
- [ ] No other functions transfer tokens
- [ ] Token contract client calls use correct parameters

### State Machine
- [ ] All state checks use `assert_status(expected)` 
- [ ] No function bypasses status checks
- [ ] Only valid transitions listed in Section 2.1 are possible
- [ ] Terminal states (Completed, Cancelled) have no outgoing transitions

### Authorization
- [ ] All state-changing functions call appropriate `assert_*` checks
- [ ] `require_auth()` is called before authorization checks
- [ ] Delegated permissions (e.g., arbitrator) are verified from storage

### Time-Locking
- [ ] `queue_operation()` sets `unlock_at = now + timelock`
- [ ] `assert_unlocked()` checks `timestamp >= unlock_at` before execution
- [ ] `cancel_operation()` checks `timestamp < unlock_at` to prevent locked cancels

### Initialization
- [ ] `initialize()` checks for prior STATUS key before setting it
- [ ] Attempting re-initialization returns `AlreadyInitialized`

