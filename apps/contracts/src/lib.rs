#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, token, Address, Env};

const DEFAULT_TIMELOCK_SECONDS: u64 = 24 * 60 * 60;

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
    ) {
        owner.require_auth();
        assert!(amount > 0, "amount must be positive");
        assert!(
            !env.storage().instance().has(&symbol_short!("STATUS")),
            "contract already initialized"
        );
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
    }

    /// Fund the bounty. Transfers `amount` tokens from owner into the contract.
    /// Transitions Created → Funded.
    pub fn fund(env: Env, owner: Address) {
        owner.require_auth();
        Self::assert_owner(&env, &owner);
        Self::assert_status(&env, BountyStatus::Created, "fund requires Created status");

        let amount: i128 = env.storage().instance().get(&symbol_short!("AMOUNT")).unwrap();
        let token_address: Address = env.storage().instance().get(&symbol_short!("TOKEN")).unwrap();
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
    }

    /// Contributor starts work. Transitions Funded → InProgress.
    pub fn start_work(env: Env, contributor: Address) {
        contributor.require_auth();
        Self::assert_status(&env, BountyStatus::Funded, "start_work requires Funded status");
        env.storage().instance().set(&symbol_short!("CONTRIB"), &contributor);
        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::InProgress);
    }

    /// Contributor submits work. Transitions InProgress → UnderReview.
    pub fn submit(env: Env, contributor: Address) {
        contributor.require_auth();
        Self::assert_contributor(&env, &contributor);
        Self::assert_status(&env, BountyStatus::InProgress, "submit requires InProgress status");
        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::UnderReview);
    }

    /// Owner approves and releases funds to contributor. Transitions UnderReview → Completed.
    pub fn approve(env: Env, owner: Address) {
        owner.require_auth();
        Self::assert_owner(&env, &owner);
        Self::assert_status(&env, BountyStatus::UnderReview, "approve requires UnderReview status");

        Self::queue_operation(&env, &owner, TimelockOperation::Approve);
    }

    /// Execute a queued approval after the time-lock expires.
    pub fn execute_approve(env: Env) {
        let pending = Self::pending_operation(&env);
        assert!(
            pending.operation == TimelockOperation::Approve,
            "pending operation is not approve"
        );
        Self::assert_unlocked(&env, &pending);
        Self::assert_status(&env, BountyStatus::UnderReview, "approve requires UnderReview status");

        let amount: i128 = env.storage().instance().get(&symbol_short!("AMOUNT")).unwrap();
        let token_address: Address = env.storage().instance().get(&symbol_short!("TOKEN")).unwrap();
        let contributor: Address = env.storage().instance().get(&symbol_short!("CONTRIB")).unwrap();
        let token = token::Client::new(&env, &token_address);
        token.transfer(&env.current_contract_address(), &contributor, &amount);

        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::Completed);
        Self::clear_pending_operation(&env);
        env.events()
            .publish((symbol_short!("execop"), symbol_short!("approve")), ());
    }

    /// Owner cancels and gets a refund. Only valid from Created or Funded.
    pub fn cancel(env: Env, owner: Address) {
        owner.require_auth();
        Self::assert_owner(&env, &owner);
        let status: BountyStatus = env.storage().instance().get(&symbol_short!("STATUS")).unwrap();
        assert!(
            status == BountyStatus::Created || status == BountyStatus::Funded,
            "cancel only allowed from Created or Funded"
        );

        Self::queue_operation(&env, &owner, TimelockOperation::Cancel);
    }

    /// Execute a queued cancellation after the time-lock expires.
    pub fn execute_cancel(env: Env) {
        let pending = Self::pending_operation(&env);
        assert!(
            pending.operation == TimelockOperation::Cancel,
            "pending operation is not cancel"
        );
        Self::assert_unlocked(&env, &pending);

        let status: BountyStatus = env.storage().instance().get(&symbol_short!("STATUS")).unwrap();
        assert!(
            status == BountyStatus::Created || status == BountyStatus::Funded,
            "cancel only allowed from Created or Funded"
        );

        if status == BountyStatus::Funded {
            let amount: i128 = env.storage().instance().get(&symbol_short!("AMOUNT")).unwrap();
            let token_address: Address = env.storage().instance().get(&symbol_short!("TOKEN")).unwrap();
            let owner: Address = env.storage().instance().get(&symbol_short!("OWNER")).unwrap();
            let token = token::Client::new(&env, &token_address);
            token.transfer(&env.current_contract_address(), &owner, &amount);
        }

        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::Cancelled);
        Self::clear_pending_operation(&env);
        env.events()
            .publish((symbol_short!("execop"), symbol_short!("cancel")), ());
    }

    /// Raise a dispute. Callable by owner or contributor when status is UnderReview.
    /// Transitions UnderReview → Disputed.
    pub fn dispute(env: Env, caller: Address) {
        caller.require_auth();
        Self::assert_status(&env, BountyStatus::UnderReview, "dispute requires UnderReview status");

        let owner: Address = env.storage().instance().get(&symbol_short!("OWNER")).unwrap();
        let contributor: Address = env.storage().instance().get(&symbol_short!("CONTRIB")).unwrap();
        assert!(
            caller == owner || caller == contributor,
            "only owner or contributor can dispute"
        );

        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::Disputed);
        Self::clear_pending_operation(&env);

        env.events().publish((symbol_short!("dispute"), caller), ());
    }

    /// Arbitrator resolves the dispute by choosing a winner.
    /// Pays out to `winner` and transitions Disputed → Completed.
    pub fn resolve(env: Env, arbitrator: Address, winner: Address) {
        arbitrator.require_auth();
        Self::assert_arbitrator(&env, &arbitrator);
        Self::assert_status(&env, BountyStatus::Disputed, "resolve requires Disputed status");

        let owner: Address = env.storage().instance().get(&symbol_short!("OWNER")).unwrap();
        let contributor: Address = env.storage().instance().get(&symbol_short!("CONTRIB")).unwrap();
        assert!(
            winner == owner || winner == contributor,
            "winner must be owner or contributor"
        );

        Self::queue_operation(&env, &arbitrator, TimelockOperation::Resolve(winner));
    }

    /// Execute a queued dispute resolution after the time-lock expires.
    pub fn execute_resolve(env: Env) {
        let pending = Self::pending_operation(&env);
        Self::assert_unlocked(&env, &pending);
        Self::assert_status(&env, BountyStatus::Disputed, "resolve requires Disputed status");

        let winner = match pending.operation {
            TimelockOperation::Resolve(winner) => winner,
            _ => panic!("pending operation is not resolve"),
        };

        let amount: i128 = env.storage().instance().get(&symbol_short!("AMOUNT")).unwrap();
        let token_address: Address = env.storage().instance().get(&symbol_short!("TOKEN")).unwrap();
        let token = token::Client::new(&env, &token_address);
        token.transfer(&env.current_contract_address(), &winner, &amount);

        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::Completed);
        Self::clear_pending_operation(&env);

        env.events().publish((symbol_short!("resolve"), winner), ());
        env.events()
            .publish((symbol_short!("execop"), symbol_short!("resolve")), ());
    }

    /// Cancel a queued operation before it unlocks. Only the initiator can cancel.
    pub fn cancel_operation(env: Env, caller: Address) {
        caller.require_auth();
        let pending = Self::pending_operation(&env);
        assert!(
            caller == pending.initiator,
            "only initiator can cancel pending operation"
        );
        assert!(
            env.ledger().timestamp() < pending.unlock_at,
            "operation already unlocked"
        );

        Self::clear_pending_operation(&env);
        env.events().publish((symbol_short!("cancelop"), caller), ());
    }

    pub fn get_owner(env: Env) -> Address {
        env.storage().instance().get(&symbol_short!("OWNER")).unwrap()
    }

    pub fn get_amount(env: Env) -> i128 {
        env.storage().instance().get(&symbol_short!("AMOUNT")).unwrap()
    }

    pub fn get_status(env: Env) -> BountyStatus {
        env.storage().instance().get(&symbol_short!("STATUS")).unwrap()
    }

    pub fn get_contributor(env: Env) -> Address {
        env.storage().instance().get(&symbol_short!("CONTRIB")).unwrap()
    }

    pub fn get_token(env: Env) -> Address {
        env.storage().instance().get(&symbol_short!("TOKEN")).unwrap()
    }

    pub fn get_arbitrator(env: Env) -> Address {
        env.storage().instance().get(&symbol_short!("ARBITRATR")).unwrap()
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

    fn queue_operation(env: &Env, initiator: &Address, operation: TimelockOperation) {
        assert!(
            !env.storage().instance().has(&symbol_short!("PENDING")),
            "pending operation already exists"
        );

        let timelock_duration = Self::get_timelock_duration(env.clone());
        let pending = PendingTimelock {
            operation,
            initiator: initiator.clone(),
            unlock_at: env.ledger().timestamp() + timelock_duration,
        };

        env.storage().instance().set(&symbol_short!("PENDING"), &pending);
        env.events()
            .publish((symbol_short!("queueop"), initiator.clone()), pending.unlock_at);
    }

    fn pending_operation(env: &Env) -> PendingTimelock {
        env.storage()
            .instance()
            .get(&symbol_short!("PENDING"))
            .expect("no pending operation")
    }

    fn clear_pending_operation(env: &Env) {
        env.storage().instance().remove(&symbol_short!("PENDING"));
    }

    fn assert_unlocked(env: &Env, pending: &PendingTimelock) {
        assert!(env.ledger().timestamp() >= pending.unlock_at, "operation still locked");
    }

    fn assert_owner(env: &Env, caller: &Address) {
        let owner: Address = env.storage().instance().get(&symbol_short!("OWNER")).unwrap();
        assert!(caller == &owner, "only owner can call this");
    }

    fn assert_contributor(env: &Env, caller: &Address) {
        let contributor: Address = env.storage().instance().get(&symbol_short!("CONTRIB")).unwrap();
        assert!(caller == &contributor, "only contributor can call this");
    }

    fn assert_arbitrator(env: &Env, caller: &Address) {
        let arbitrator: Address = env.storage().instance().get(&symbol_short!("ARBITRATR")).unwrap();
        assert!(caller == &arbitrator, "only arbitrator can call this");
    }

    fn assert_status(env: &Env, expected: BountyStatus, msg: &'static str) {
        let status: BountyStatus = env.storage().instance().get(&symbol_short!("STATUS")).unwrap();
        assert!(status == expected, "{}", msg);
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
    #[should_panic(expected = "amount must be positive")]
    fn test_initialize_rejects_zero_amount() {
        let (_, client, owner, token_address, _, arbitrator, _) = setup();
        client.initialize(&owner, &0, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);
    }

    #[test]
    #[should_panic(expected = "amount must be positive")]
    fn test_initialize_rejects_negative_amount() {
        let (_, client, owner, token_address, _, arbitrator, _) = setup();
        client.initialize(&owner, &-1, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);
    }

    #[test]
    #[should_panic(expected = "contract already initialized")]
    fn test_reinitialize_after_deploy_panics_to_protect_upgrade_state() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);

        let new_owner = Address::generate(&env);
        let new_arbitrator = Address::generate(&env);
        client.initialize(
            &new_owner,
            &500,
            &token_address,
            &new_arbitrator,
            &DEFAULT_TIMELOCK_SECONDS,
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
    #[should_panic(expected = "only owner can call this")]
    fn test_fund_by_non_owner_panics() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);

        let not_owner = Address::generate(&env);
        client.fund(&not_owner);
    }

    #[test]
    #[should_panic]
    fn test_fund_with_insufficient_allowance_panics() {
        let (env, client, owner, token_address, contract_id, arbitrator, amount) = setup();
        let token = TokenClient::new(&env, &token_address);
        token.approve(&owner, &contract_id, &(amount - 1), &200);

        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);
        client.fund(&owner);
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
    #[should_panic(expected = "operation still locked")]
    fn test_execute_approve_before_timelock_panics() {
        let (_, client, owner, _, _, _, _, _) = setup_under_review();
        client.approve(&owner);
        client.execute_approve();
    }

    #[test]
    #[should_panic(expected = "no pending operation")]
    fn test_cancel_operation_halts_queued_approve() {
        let (env, client, owner, _, _, _, _, _) = setup_under_review();
        client.approve(&owner);
        client.cancel_operation(&owner);

        unlock_pending(&env);
        client.execute_approve();
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
    #[should_panic(expected = "start_work requires Funded status")]
    fn test_start_work_before_funding_panics() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);

        let contributor = Address::generate(&env);
        client.start_work(&contributor);
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
    #[should_panic(expected = "only contributor can call this")]
    fn test_submit_by_non_contributor_panics() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);
        client.fund(&owner);
        let contributor = Address::generate(&env);
        client.start_work(&contributor);

        let not_contributor = Address::generate(&env);
        client.submit(&not_contributor);
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
    #[should_panic(expected = "no pending operation")]
    fn test_dispute_halts_queued_approval() {
        let (env, client, owner, _, _, _, contributor, _) = setup_under_review();
        client.approve(&owner);
        client.dispute(&contributor);
        assert_eq!(client.get_status(), BountyStatus::Disputed);

        unlock_pending(&env);
        client.execute_approve();
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
    #[should_panic(expected = "only owner or contributor can dispute")]
    fn test_dispute_by_stranger_panics() {
        let (env, client, _, _, _, _, _, _) = setup_under_review();
        let stranger = Address::generate(&env);
        client.dispute(&stranger);
    }

    #[test]
    #[should_panic(expected = "dispute requires UnderReview status")]
    fn test_dispute_wrong_status_panics() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);
        client.fund(&owner);
        let contributor = Address::generate(&env);
        client.start_work(&contributor);
        // Still InProgress, not UnderReview
        client.dispute(&owner);
    }

    #[test]
    #[should_panic(expected = "only arbitrator can call this")]
    fn test_resolve_by_non_arbitrator_panics() {
        let (env, client, _, _, _, _, contributor, _) = setup_under_review();
        client.dispute(&contributor);
        let stranger = Address::generate(&env);
        client.resolve(&stranger, &contributor);
    }

    #[test]
    #[should_panic(expected = "winner must be owner or contributor")]
    fn test_resolve_with_invalid_winner_panics() {
        let (env, client, _, _, _, arbitrator, contributor, _) = setup_under_review();
        client.dispute(&contributor);
        let stranger = Address::generate(&env);
        client.resolve(&arbitrator, &stranger);
    }

    #[test]
    #[should_panic(expected = "only owner can call this")]
    fn test_approve_unauthorized_panics() {
        let (env, client, _, _, _, _, _, _) = setup_under_review();
        let not_owner = Address::generate(&env);
        client.approve(&not_owner);
    }

    #[test]
    #[should_panic(expected = "approve requires UnderReview status")]
    fn test_approve_before_submit_panics() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);
        client.fund(&owner);
        let contributor = Address::generate(&env);
        client.start_work(&contributor);

        client.approve(&owner);
    }

    #[test]
    #[should_panic(expected = "cancel only allowed from Created or Funded")]
    fn test_cancel_from_in_progress_panics() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);
        client.fund(&owner);
        let contributor = Address::generate(&env);
        client.start_work(&contributor);
        client.cancel(&owner);
    }

    #[test]
    #[should_panic(expected = "fund requires Created status")]
    fn test_double_fund_panics() {
        let (_, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator, &DEFAULT_TIMELOCK_SECONDS);
        client.fund(&owner);
        client.fund(&owner);
    }

    #[test]
    #[should_panic(expected = "resolve requires Disputed status")]
    fn test_resolve_before_dispute_panics() {
        let (_, client, _, _, _, arbitrator, contributor, _) = setup_under_review();
        client.resolve(&arbitrator, &contributor);
    }
}
