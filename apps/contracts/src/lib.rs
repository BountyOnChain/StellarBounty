#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env};

const DEFAULT_TIMELOCK_SECONDS: u64 = 24 * 60 * 60;

/// Errors returned by the escrow contract.
///
/// Each variant maps to a stable on-chain error code so callers receive an
/// actionable reason instead of a generic host panic. Returning these from a
/// `Result` means storage reads on a missing key no longer trap and revert the
/// whole transaction with no explanation.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    /// Contract storage has not been initialized — call `initialize` first.
    NotInitialized = 1,
    /// Contract has already been initialized and cannot be initialized again.
    AlreadyInitialized = 2,
    /// Caller is not authorized to perform this action.
    Unauthorized = 3,
    /// The bounty is not in the status required for this action.
    InvalidStatus = 4,
    /// The chosen winner must be the owner or the contributor.
    InvalidWinner = 5,
    /// The account does not hold enough balance for this action.
    InsufficientBalance = 6,
    /// The bounty amount must be a positive value.
    InvalidAmount = 7,
    /// No time-locked operation is currently queued.
    NoPendingOperation = 8,
    /// A time-locked operation is already queued; clear it first.
    PendingOperationExists = 9,
    /// The queued operation is still time-locked and cannot run yet.
    OperationLocked = 10,
    /// The queued operation has already unlocked and cannot be cancelled.
    OperationAlreadyUnlocked = 11,
    /// The queued operation does not match the requested execution.
    InvalidOperation = 12,
}

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum BountyStatus {
    Created,
    Funded,
    InProgress,
    UnderReview,
    Disputed,
    Completed,
    Cancelled,
}

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum TimelockOperation {
    Approve,
    Cancel,
    Resolve(Address),
}

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub struct PendingTimelock {
    pub operation: TimelockOperation,
    pub initiator: Address,
    pub unlock_at: u64,
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// Initialize a bounty. Sets owner, amount, token address, arbitrator, and status to Created.
    pub fn initialize(
        env: Env,
        owner: Address,
        amount: i128,
        token_address: Address,
        arbitrator: Address,
        timelock_duration: u64,
    ) -> Result<(), ContractError> {
        owner.require_auth();
        if amount <= 0 {
            return Err(ContractError::InvalidAmount);
        }
        if env.storage().instance().has(&symbol_short!("STATUS")) {
            return Err(ContractError::AlreadyInitialized);
        }
        env.storage().instance().set(&symbol_short!("OWNER"), &owner);
        env.storage().instance().set(&symbol_short!("AMOUNT"), &amount);
        env.storage().instance().set(&symbol_short!("TOKEN"), &token_address);
        env.storage().instance().set(&symbol_short!("ARBITRATR"), &arbitrator);
        env.storage()
            .instance()
            .set(&symbol_short!("TIMELOCK"), &Self::normalize_timelock(timelock_duration));
        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::Created);
        Ok(())
    }

    /// Fund the bounty. Transfers `amount` tokens from owner into the contract.
    /// Transitions Created → Funded.
    pub fn fund(env: Env, owner: Address) -> Result<(), ContractError> {
        owner.require_auth();
        Self::assert_owner(&env, &owner)?;
        Self::assert_status(&env, BountyStatus::Created)?;

        let amount = Self::read_amount(&env)?;
        let token_address = Self::read_token(&env)?;
        let token = token::Client::new(&env, &token_address);
        token.transfer_from(
            &env.current_contract_address(),
            &owner,
            &env.current_contract_address(),
            &amount,
        );

        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::Funded);
        Ok(())
    }

    /// Contributor starts work. Transitions Funded → InProgress.
    pub fn start_work(env: Env, contributor: Address) -> Result<(), ContractError> {
        contributor.require_auth();
        Self::assert_status(&env, BountyStatus::Funded)?;
        env.storage().instance().set(&symbol_short!("CONTRIB"), &contributor);
        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::InProgress);
        Ok(())
    }

    /// Contributor submits work. Transitions InProgress → UnderReview.
    pub fn submit(env: Env, contributor: Address) -> Result<(), ContractError> {
        contributor.require_auth();
        Self::assert_contributor(&env, &contributor)?;
        Self::assert_status(&env, BountyStatus::InProgress)?;
        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::UnderReview);
        Ok(())
    }

    /// Owner approves and releases funds to contributor. Transitions UnderReview → Completed.
    pub fn approve(env: Env, owner: Address) -> Result<(), ContractError> {
        owner.require_auth();
        Self::assert_owner(&env, &owner)?;
        Self::assert_status(&env, BountyStatus::UnderReview)?;

        Self::queue_operation(&env, &owner, TimelockOperation::Approve)
    }

    /// Execute a queued approval after the time-lock expires.
    pub fn execute_approve(env: Env) -> Result<(), ContractError> {
        let pending = Self::pending_operation(&env)?;
        if pending.operation != TimelockOperation::Approve {
            return Err(ContractError::InvalidOperation);
        }
        Self::assert_unlocked(&env, &pending)?;
        Self::assert_status(&env, BountyStatus::UnderReview)?;

        let amount = Self::read_amount(&env)?;
        let token_address = Self::read_token(&env)?;
        let contributor = Self::read_contributor(&env)?;
        let token = token::Client::new(&env, &token_address);
        token.transfer(&env.current_contract_address(), &contributor, &amount);

        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::Completed);
        Self::clear_pending_operation(&env);
        env.events()
            .publish((symbol_short!("execop"), symbol_short!("approve")), ());
        Ok(())
    }

    /// Owner cancels and gets a refund. Only valid from Created or Funded.
    pub fn cancel(env: Env, owner: Address) -> Result<(), ContractError> {
        owner.require_auth();
        Self::assert_owner(&env, &owner)?;
        let status = Self::read_status(&env)?;
        if status != BountyStatus::Created && status != BountyStatus::Funded {
            return Err(ContractError::InvalidStatus);
        }

        Self::queue_operation(&env, &owner, TimelockOperation::Cancel)
    }

    /// Execute a queued cancellation after the time-lock expires.
    pub fn execute_cancel(env: Env) -> Result<(), ContractError> {
        let pending = Self::pending_operation(&env)?;
        if pending.operation != TimelockOperation::Cancel {
            return Err(ContractError::InvalidOperation);
        }
        Self::assert_unlocked(&env, &pending)?;

        let status = Self::read_status(&env)?;
        if status != BountyStatus::Created && status != BountyStatus::Funded {
            return Err(ContractError::InvalidStatus);
        }

        if status == BountyStatus::Funded {
            let amount = Self::read_amount(&env)?;
            let token_address = Self::read_token(&env)?;
            let owner = Self::read_owner(&env)?;
            let token = token::Client::new(&env, &token_address);
            token.transfer(&env.current_contract_address(), &owner, &amount);
        }

        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::Cancelled);
        Self::clear_pending_operation(&env);
        env.events()
            .publish((symbol_short!("execop"), symbol_short!("cancel")), ());
        Ok(())
    }

    /// Raise a dispute. Callable by owner or contributor when status is UnderReview.
    /// Transitions UnderReview → Disputed.
    pub fn dispute(env: Env, caller: Address) -> Result<(), ContractError> {
        caller.require_auth();
        Self::assert_status(&env, BountyStatus::UnderReview)?;

        let owner = Self::read_owner(&env)?;
        let contributor = Self::read_contributor(&env)?;
        if caller != owner && caller != contributor {
            return Err(ContractError::Unauthorized);
        }

        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::Disputed);
        Self::clear_pending_operation(&env);

        env.events().publish((symbol_short!("dispute"), caller), ());
        Ok(())
    }

    /// Arbitrator resolves the dispute by choosing a winner.
    /// Pays out to `winner` and transitions Disputed → Completed.
    pub fn resolve(env: Env, arbitrator: Address, winner: Address) -> Result<(), ContractError> {
        arbitrator.require_auth();
        Self::assert_arbitrator(&env, &arbitrator)?;
        Self::assert_status(&env, BountyStatus::Disputed)?;

        let owner = Self::read_owner(&env)?;
        let contributor = Self::read_contributor(&env)?;
        if winner != owner && winner != contributor {
            return Err(ContractError::InvalidWinner);
        }

        Self::queue_operation(&env, &arbitrator, TimelockOperation::Resolve(winner))
    }

    /// Execute a queued dispute resolution after the time-lock expires.
    pub fn execute_resolve(env: Env) -> Result<(), ContractError> {
        let pending = Self::pending_operation(&env)?;
        Self::assert_unlocked(&env, &pending)?;
        Self::assert_status(&env, BountyStatus::Disputed)?;

        let winner = match pending.operation {
            TimelockOperation::Resolve(winner) => winner,
            _ => return Err(ContractError::InvalidOperation),
        };

        let amount = Self::read_amount(&env)?;
        let token_address = Self::read_token(&env)?;
        let token = token::Client::new(&env, &token_address);
        token.transfer(&env.current_contract_address(), &winner, &amount);

        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::Completed);
        Self::clear_pending_operation(&env);

        env.events().publish((symbol_short!("resolve"), winner), ());
        env.events()
            .publish((symbol_short!("execop"), symbol_short!("resolve")), ());
        Ok(())
    }

    /// Cancel a queued operation before it unlocks. Only the initiator can cancel.
    pub fn cancel_operation(env: Env, caller: Address) -> Result<(), ContractError> {
        caller.require_auth();
        let pending = Self::pending_operation(&env)?;
        if caller != pending.initiator {
            return Err(ContractError::Unauthorized);
        }
        if env.ledger().timestamp() >= pending.unlock_at {
            return Err(ContractError::OperationAlreadyUnlocked);
        }

        Self::clear_pending_operation(&env);
        env.events().publish((symbol_short!("cancelop"), caller), ());
        Ok(())
    }

    pub fn get_owner(env: Env) -> Result<Address, ContractError> {
        Self::read_owner(&env)
    }

    pub fn get_amount(env: Env) -> Result<i128, ContractError> {
        Self::read_amount(&env)
    }

    pub fn get_status(env: Env) -> Result<BountyStatus, ContractError> {
        Self::read_status(&env)
    }

    pub fn get_contributor(env: Env) -> Result<Address, ContractError> {
        Self::read_contributor(&env)
    }

    pub fn get_token(env: Env) -> Result<Address, ContractError> {
        Self::read_token(&env)
    }

    pub fn get_arbitrator(env: Env) -> Result<Address, ContractError> {
        Self::read_arbitrator(&env)
    }

    pub fn get_timelock_duration(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&symbol_short!("TIMELOCK"))
            .unwrap_or(DEFAULT_TIMELOCK_SECONDS)
    }

    // --- helpers ---

    fn normalize_timelock(timelock_duration: u64) -> u64 {
        if timelock_duration == 0 {
            DEFAULT_TIMELOCK_SECONDS
        } else {
            timelock_duration
        }
    }

    fn read_owner(env: &Env) -> Result<Address, ContractError> {
        env.storage()
            .instance()
            .get(&symbol_short!("OWNER"))
            .ok_or(ContractError::NotInitialized)
    }

    fn read_amount(env: &Env) -> Result<i128, ContractError> {
        env.storage()
            .instance()
            .get(&symbol_short!("AMOUNT"))
            .ok_or(ContractError::NotInitialized)
    }

    fn read_token(env: &Env) -> Result<Address, ContractError> {
        env.storage()
            .instance()
            .get(&symbol_short!("TOKEN"))
            .ok_or(ContractError::NotInitialized)
    }

    fn read_contributor(env: &Env) -> Result<Address, ContractError> {
        env.storage()
            .instance()
            .get(&symbol_short!("CONTRIB"))
            .ok_or(ContractError::NotInitialized)
    }

    fn read_arbitrator(env: &Env) -> Result<Address, ContractError> {
        env.storage()
            .instance()
            .get(&symbol_short!("ARBITRATR"))
            .ok_or(ContractError::NotInitialized)
    }

    fn read_status(env: &Env) -> Result<BountyStatus, ContractError> {
        env.storage()
            .instance()
            .get(&symbol_short!("STATUS"))
            .ok_or(ContractError::NotInitialized)
    }

    fn queue_operation(env: &Env, initiator: &Address, operation: TimelockOperation) -> Result<(), ContractError> {
        if env.storage().instance().has(&symbol_short!("PENDING")) {
            return Err(ContractError::PendingOperationExists);
        }

        let timelock_duration = Self::get_timelock_duration(env.clone());
        let pending = PendingTimelock {
            operation,
            initiator: initiator.clone(),
            unlock_at: env.ledger().timestamp() + timelock_duration,
        };

        env.storage().instance().set(&symbol_short!("PENDING"), &pending);
        env.events()
            .publish((symbol_short!("queueop"), initiator.clone()), pending.unlock_at);
        Ok(())
    }

    fn pending_operation(env: &Env) -> Result<PendingTimelock, ContractError> {
        env.storage()
            .instance()
            .get(&symbol_short!("PENDING"))
            .ok_or(ContractError::NoPendingOperation)
    }

    fn clear_pending_operation(env: &Env) {
        env.storage().instance().remove(&symbol_short!("PENDING"));
    }

    fn assert_unlocked(env: &Env, pending: &PendingTimelock) -> Result<(), ContractError> {
        if env.ledger().timestamp() < pending.unlock_at {
            return Err(ContractError::OperationLocked);
        }
        Ok(())
    }

    fn assert_owner(env: &Env, caller: &Address) -> Result<(), ContractError> {
        let owner = Self::read_owner(env)?;
        if caller != &owner {
            return Err(ContractError::Unauthorized);
        }
        Ok(())
    }

    fn assert_contributor(env: &Env, caller: &Address) -> Result<(), ContractError> {
        let contributor = Self::read_contributor(env)?;
        if caller != &contributor {
            return Err(ContractError::Unauthorized);
        }
        Ok(())
    }

    fn assert_arbitrator(env: &Env, caller: &Address) -> Result<(), ContractError> {
        let arbitrator = Self::read_arbitrator(env)?;
        if caller != &arbitrator {
            return Err(ContractError::Unauthorized);
        }
        Ok(())
    }

    fn assert_status(env: &Env, expected: BountyStatus) -> Result<(), ContractError> {
        let status = Self::read_status(env)?;
        if status != expected {
            return Err(ContractError::InvalidStatus);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        token::{Client as TokenClient, StellarAssetClient},
        Address, Env,
    };

    fn setup() -> (
        Env,
        EscrowContractClient<'static>,
        Address,
        Address,
        Address,
        Address,
        i128,
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let token_admin = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_address = token_id.address();
        let token_admin_client = StellarAssetClient::new(&env, &token_address);

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let arbitrator = Address::generate(&env);
        let amount: i128 = 1000;

        token_admin_client.mint(&owner, &amount);

        let token_client = TokenClient::new(&env, &token_address);
        token_client.approve(&owner, &contract_id, &amount, &200);

        (env, client, owner, token_address, contract_id, arbitrator, amount)
    }

    fn unlock_pending(env: &Env) {
        env.ledger()
            .set_timestamp(env.ledger().timestamp() + DEFAULT_TIMELOCK_SECONDS);
    }

    fn setup_under_review() -> (
        Env,
        EscrowContractClient<'static>,
        Address,
        Address,
        Address,
        Address,
        Address,
        i128,
    ) {
        let (env, client, owner, token_address, contract_id, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);
        client.fund(&owner);
        let contributor = Address::generate(&env);
        client.start_work(&contributor);
        client.submit(&contributor);
        (
            env,
            client,
            owner,
            token_address,
            contract_id,
            arbitrator,
            contributor,
            amount,
        )
    }

    #[test]
    fn test_initialize_stores_fields() {
        let (_, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);
        assert_eq!(client.get_owner(), owner);
        assert_eq!(client.get_amount(), amount);
        assert_eq!(client.get_token(), token_address);
        assert_eq!(client.get_arbitrator(), arbitrator);
        assert_eq!(client.get_timelock_duration(), DEFAULT_TIMELOCK_SECONDS);
        assert_eq!(client.get_status(), BountyStatus::Created);
    }

    #[test]
    fn test_initialize_defaults_zero_timelock_to_twenty_four_hours() {
        let (_, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator, &0);
        assert_eq!(client.get_timelock_duration(), DEFAULT_TIMELOCK_SECONDS);
    }

    #[test]
    fn test_initialize_rejects_zero_amount() {
        let (_, client, owner, token_address, _, arbitrator, _) = setup();
        assert_eq!(
            client.try_initialize(&owner, &0, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS),
            Err(Ok(ContractError::InvalidAmount))
        );
    }

    #[test]
    fn test_initialize_rejects_negative_amount() {
        let (_, client, owner, token_address, _, arbitrator, _) = setup();
        assert_eq!(
            client.try_initialize(&owner, &-1, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS),
            Err(Ok(ContractError::InvalidAmount))
        );
    }

    #[test]
    fn test_reinitialize_after_deploy_errs_to_protect_upgrade_state() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);

        let new_owner = Address::generate(&env);
        let new_arbitrator = Address::generate(&env);
        assert_eq!(
            client.try_initialize(
                &new_owner,
                &500,
                &token_address,
                &new_arbitrator,
                &DEFAULT_TIMELOCK_SECONDS,
            ),
            Err(Ok(ContractError::AlreadyInitialized))
        );
    }

    #[test]
    fn test_fund_transfers_tokens_and_transitions() {
        let (env, client, owner, token_address, contract_id, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);

        let token = TokenClient::new(&env, &token_address);
        assert_eq!(token.balance(&owner), amount);

        client.fund(&owner);

        assert_eq!(client.get_status(), BountyStatus::Funded);
        assert_eq!(token.balance(&owner), 0);
        assert_eq!(token.balance(&contract_id), amount);
    }

    #[test]
    fn test_fund_by_non_owner_errs() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);

        let not_owner = Address::generate(&env);
        assert_eq!(client.try_fund(&not_owner), Err(Ok(ContractError::Unauthorized)));
    }

    #[test]
    fn test_fund_with_insufficient_allowance_errs() {
        let (env, client, owner, token_address, contract_id, arbitrator, amount) = setup();
        let token = TokenClient::new(&env, &token_address);
        token.approve(&owner, &contract_id, &(amount - 1), &200);

        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);
        assert!(client.try_fund(&owner).is_err());
    }

    #[test]
    fn test_fund_on_uninitialized_contract_errs() {
        let (_, client, owner, _, _, _, _) = setup();
        assert_eq!(client.try_fund(&owner), Err(Ok(ContractError::NotInitialized)));
    }

    #[test]
    fn test_approve_pays_contributor() {
        let (env, client, owner, token_address, contract_id, _arbitrator, contributor, amount) = setup_under_review();

        let token = TokenClient::new(&env, &token_address);
        assert_eq!(token.balance(&contract_id), amount);

        client.approve(&owner);
        assert_eq!(client.get_status(), BountyStatus::UnderReview);
        assert_eq!(token.balance(&contributor), 0);
        assert_eq!(token.balance(&contract_id), amount);

        unlock_pending(&env);
        client.execute_approve();

        assert_eq!(client.get_status(), BountyStatus::Completed);
        assert_eq!(token.balance(&contributor), amount);
        assert_eq!(token.balance(&contract_id), 0);
    }

    #[test]
    fn test_approve_on_uninitialized_contract_errs() {
        let (env, client, _, _, _, _, _) = setup();
        let caller = Address::generate(&env);
        assert_eq!(client.try_approve(&caller), Err(Ok(ContractError::NotInitialized)));
    }

    #[test]
    fn test_execute_approve_before_timelock_errs() {
        let (_, client, owner, _, _, _, _, _) = setup_under_review();
        client.approve(&owner);
        assert_eq!(client.try_execute_approve(), Err(Ok(ContractError::OperationLocked)));
    }

    #[test]
    fn test_execute_approve_without_pending_errs() {
        let (_, client, _, _, _, _, _, _) = setup_under_review();
        assert_eq!(client.try_execute_approve(), Err(Ok(ContractError::NoPendingOperation)));
    }

    #[test]
    fn test_cancel_operation_halts_queued_approve() {
        let (env, client, owner, _, _, _, _, _) = setup_under_review();
        client.approve(&owner);
        client.cancel_operation(&owner);

        unlock_pending(&env);
        assert_eq!(client.try_execute_approve(), Err(Ok(ContractError::NoPendingOperation)));
    }

    #[test]
    fn test_cancel_from_funded_refunds_owner() {
        let (env, client, owner, token_address, contract_id, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);
        client.fund(&owner);

        let token = TokenClient::new(&env, &token_address);
        assert_eq!(token.balance(&contract_id), amount);
        assert_eq!(token.balance(&owner), 0);

        client.cancel(&owner);
        assert_eq!(client.get_status(), BountyStatus::Funded);
        assert_eq!(token.balance(&owner), 0);
        assert_eq!(token.balance(&contract_id), amount);

        unlock_pending(&env);
        client.execute_cancel();

        assert_eq!(client.get_status(), BountyStatus::Cancelled);
        assert_eq!(token.balance(&owner), amount);
        assert_eq!(token.balance(&contract_id), 0);
    }

    #[test]
    fn test_cancel_from_created_no_transfer() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);

        let token = TokenClient::new(&env, &token_address);
        let owner_balance_before = token.balance(&owner);

        client.cancel(&owner);
        assert_eq!(client.get_status(), BountyStatus::Created);
        assert_eq!(token.balance(&owner), owner_balance_before);

        unlock_pending(&env);
        client.execute_cancel();

        assert_eq!(client.get_status(), BountyStatus::Cancelled);
        assert_eq!(token.balance(&owner), owner_balance_before);
    }

    #[test]
    fn test_start_work_transitions_to_in_progress() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);
        client.fund(&owner);
        let contributor = Address::generate(&env);
        client.start_work(&contributor);
        assert_eq!(client.get_status(), BountyStatus::InProgress);
        assert_eq!(client.get_contributor(), contributor);
    }

    #[test]
    fn test_start_work_before_funding_errs() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);

        let contributor = Address::generate(&env);
        assert_eq!(
            client.try_start_work(&contributor),
            Err(Ok(ContractError::InvalidStatus))
        );
    }

    #[test]
    fn test_submit_transitions_to_under_review() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);
        client.fund(&owner);
        let contributor = Address::generate(&env);
        client.start_work(&contributor);
        client.submit(&contributor);
        assert_eq!(client.get_status(), BountyStatus::UnderReview);
    }

    #[test]
    fn test_submit_by_non_contributor_errs() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);
        client.fund(&owner);
        let contributor = Address::generate(&env);
        client.start_work(&contributor);

        let not_contributor = Address::generate(&env);
        assert_eq!(
            client.try_submit(&not_contributor),
            Err(Ok(ContractError::Unauthorized))
        );
    }

    #[test]
    fn test_dispute_by_owner_transitions_to_disputed() {
        let (_, client, owner, _, _, _, _, _) = setup_under_review();
        client.dispute(&owner);
        assert_eq!(client.get_status(), BountyStatus::Disputed);
    }

    #[test]
    fn test_dispute_by_contributor_transitions_to_disputed() {
        let (_, client, _, _, _, _, contributor, _) = setup_under_review();
        client.dispute(&contributor);
        assert_eq!(client.get_status(), BountyStatus::Disputed);
    }

    #[test]
    fn test_dispute_halts_queued_approval() {
        let (env, client, owner, _, _, _, contributor, _) = setup_under_review();
        client.approve(&owner);
        client.dispute(&contributor);
        assert_eq!(client.get_status(), BountyStatus::Disputed);

        unlock_pending(&env);
        assert_eq!(client.try_execute_approve(), Err(Ok(ContractError::NoPendingOperation)));
    }

    #[test]
    fn test_resolve_pays_contributor_and_completes() {
        let (env, client, _, token_address, contract_id, arbitrator, contributor, amount) = setup_under_review();
        client.dispute(&contributor);

        let token = TokenClient::new(&env, &token_address);
        assert_eq!(token.balance(&contract_id), amount);

        client.resolve(&arbitrator, &contributor);
        assert_eq!(client.get_status(), BountyStatus::Disputed);
        assert_eq!(token.balance(&contributor), 0);
        assert_eq!(token.balance(&contract_id), amount);

        unlock_pending(&env);
        client.execute_resolve();

        assert_eq!(client.get_status(), BountyStatus::Completed);
        assert_eq!(token.balance(&contributor), amount);
        assert_eq!(token.balance(&contract_id), 0);
    }

    #[test]
    fn test_resolve_pays_owner_and_completes() {
        let (env, client, owner, token_address, contract_id, arbitrator, contributor, amount) = setup_under_review();
        client.dispute(&contributor);

        let token = TokenClient::new(&env, &token_address);
        client.resolve(&arbitrator, &owner);
        assert_eq!(client.get_status(), BountyStatus::Disputed);
        assert_eq!(token.balance(&owner), 0);
        assert_eq!(token.balance(&contract_id), amount);

        unlock_pending(&env);
        client.execute_resolve();

        assert_eq!(client.get_status(), BountyStatus::Completed);
        assert_eq!(token.balance(&owner), amount);
        assert_eq!(token.balance(&contract_id), 0);
    }

    #[test]
    fn test_dispute_by_stranger_errs() {
        let (env, client, _, _, _, _, _, _) = setup_under_review();
        let stranger = Address::generate(&env);
        assert_eq!(client.try_dispute(&stranger), Err(Ok(ContractError::Unauthorized)));
    }

    #[test]
    fn test_dispute_wrong_status_errs() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);
        client.fund(&owner);
        let contributor = Address::generate(&env);
        client.start_work(&contributor);
        // Still InProgress, not UnderReview
        assert_eq!(client.try_dispute(&owner), Err(Ok(ContractError::InvalidStatus)));
    }

    #[test]
    fn test_resolve_by_non_arbitrator_errs() {
        let (env, client, _, _, _, _, contributor, _) = setup_under_review();
        client.dispute(&contributor);
        let stranger = Address::generate(&env);
        assert_eq!(
            client.try_resolve(&stranger, &contributor),
            Err(Ok(ContractError::Unauthorized))
        );
    }

    #[test]
    fn test_resolve_with_invalid_winner_errs() {
        let (env, client, _, _, _, arbitrator, contributor, _) = setup_under_review();
        client.dispute(&contributor);
        let stranger = Address::generate(&env);
        assert_eq!(
            client.try_resolve(&arbitrator, &stranger),
            Err(Ok(ContractError::InvalidWinner))
        );
    }

    #[test]
    fn test_approve_unauthorized_errs() {
        let (env, client, _, _, _, _, _, _) = setup_under_review();
        let not_owner = Address::generate(&env);
        assert_eq!(client.try_approve(&not_owner), Err(Ok(ContractError::Unauthorized)));
    }

    #[test]
    fn test_approve_before_submit_errs() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);
        client.fund(&owner);
        let contributor = Address::generate(&env);
        client.start_work(&contributor);

        assert_eq!(client.try_approve(&owner), Err(Ok(ContractError::InvalidStatus)));
    }

    #[test]
    fn test_cancel_from_in_progress_errs() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);
        client.fund(&owner);
        let contributor = Address::generate(&env);
        client.start_work(&contributor);
        assert_eq!(client.try_cancel(&owner), Err(Ok(ContractError::InvalidStatus)));
    }

    #[test]
    fn test_double_fund_errs() {
        let (_, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);
        client.fund(&owner);
        assert_eq!(client.try_fund(&owner), Err(Ok(ContractError::InvalidStatus)));
    }

    #[test]
    fn test_resolve_before_dispute_errs() {
        let (_, client, _, _, _, arbitrator, contributor, _) = setup_under_review();
        assert_eq!(
            client.try_resolve(&arbitrator, &contributor),
            Err(Ok(ContractError::InvalidStatus))
        );
    }
}
