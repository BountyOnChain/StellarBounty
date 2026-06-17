#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum ContractError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    NotOwner = 4,
    NotContributor = 5,
    NotArbitrator = 6,
    InvalidStatus = 7,
    InvalidWinner = 8,
    InvalidAmount = 9,
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

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// Initialize a bounty. Sets owner, amount, token, arbitrator, and status to Created.
    pub fn initialize(env: Env, owner: Address, amount: i128, token: Address, arbitrator: Address) {
        owner.require_auth();
        if amount <= 0 {
            env.panic_with_error(ContractError::InvalidAmount);
        }
        if env.storage().instance().has(&symbol_short!("STATUS")) {
            env.panic_with_error(ContractError::AlreadyInitialized);
        }
        env.storage().instance().set(&symbol_short!("OWNER"), &owner);
        env.storage().instance().set(&symbol_short!("AMOUNT"), &amount);
        env.storage().instance().set(&symbol_short!("TOKEN"), &token);
        env.storage().instance().set(&symbol_short!("ARBITRATR"), &arbitrator);
        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::Created);
    }

    /// Fund the bounty. Transfers tokens from owner into the contract.
    pub fn fund(env: Env, owner: Address) {
        owner.require_auth();
        Self::assert_owner(&env, &owner);
        Self::assert_status(&env, BountyStatus::Created);

        let amount: i128 = env.storage()
            .instance()
            .get(&symbol_short!("AMOUNT"))
            .unwrap_or_else(|| env.panic_with_error(ContractError::NotInitialized));
        let token_address: Address = env.storage()
            .instance()
            .get(&symbol_short!("TOKEN"))
            .unwrap_or_else(|| env.panic_with_error(ContractError::NotInitialized));
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

    /// Contributor starts work. Transitions Funded to InProgress.
    pub fn start_work(env: Env, contributor: Address) {
        contributor.require_auth();
        Self::assert_status(&env, BountyStatus::Funded);
        env.storage().instance().set(&symbol_short!("CONTRIB"), &contributor);
        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::InProgress);
    }

    /// Contributor submits work. Transitions InProgress to UnderReview.
    pub fn submit(env: Env, contributor: Address) {
        contributor.require_auth();
        Self::assert_contributor(&env, &contributor);
        Self::assert_status(&env, BountyStatus::InProgress);
        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::UnderReview);
    }

    /// Owner approves and releases funds to contributor.
    pub fn approve(env: Env, owner: Address) {
        owner.require_auth();
        Self::assert_owner(&env, &owner);
        Self::assert_status(&env, BountyStatus::UnderReview);

        let amount: i128 = env.storage()
            .instance()
            .get(&symbol_short!("AMOUNT"))
            .unwrap_or_else(|| env.panic_with_error(ContractError::NotInitialized));
        let token_address: Address = env.storage()
            .instance()
            .get(&symbol_short!("TOKEN"))
            .unwrap_or_else(|| env.panic_with_error(ContractError::NotInitialized));
        let contributor: Address = env.storage()
            .instance()
            .get(&symbol_short!("CONTRIB"))
            .unwrap_or_else(|| env.panic_with_error(ContractError::NotInitialized));
        let token = token::Client::new(&env, &token_address);
        token.transfer(&env.current_contract_address(), &contributor, &amount);

        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::Completed);
    }

    /// Owner cancels and gets a refund. Only valid from Created or Funded.
    pub fn cancel(env: Env, owner: Address) {
        owner.require_auth();
        Self::assert_owner(&env, &owner);
        let status: BountyStatus = env.storage()
            .instance()
            .get(&symbol_short!("STATUS"))
            .unwrap_or_else(|| env.panic_with_error(ContractError::NotInitialized));
        if status != BountyStatus::Created && status != BountyStatus::Funded {
            env.panic_with_error(ContractError::InvalidStatus);
        }

        if status == BountyStatus::Funded {
            let amount: i128 = env.storage()
                .instance()
                .get(&symbol_short!("AMOUNT"))
                .unwrap_or_else(|| env.panic_with_error(ContractError::NotInitialized));
            let token_address: Address = env.storage()
                .instance()
                .get(&symbol_short!("TOKEN"))
                .unwrap_or_else(|| env.panic_with_error(ContractError::NotInitialized));
            let token = token::Client::new(&env, &token_address);
            token.transfer(&env.current_contract_address(), &owner, &amount);
        }

        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::Cancelled);
    }

    /// Raise a dispute. Callable by owner or contributor when UnderReview.
    pub fn dispute(env: Env, caller: Address) {
        caller.require_auth();
        Self::assert_status(&env, BountyStatus::UnderReview);

        let owner: Address = env.storage()
            .instance()
            .get(&symbol_short!("OWNER"))
            .unwrap_or_else(|| env.panic_with_error(ContractError::NotInitialized));
        let contributor: Address = env.storage()
            .instance()
            .get(&symbol_short!("CONTRIB"))
            .unwrap_or_else(|| env.panic_with_error(ContractError::NotInitialized));
        if caller != owner && caller != contributor {
            env.panic_with_error(ContractError::Unauthorized);
        }

        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::Disputed);

        env.events().publish((symbol_short!("dispute"), caller), ());
    }

    /// Arbitrator resolves the dispute by choosing a winner.
    pub fn resolve(env: Env, arbitrator: Address, winner: Address) {
        arbitrator.require_auth();
        Self::assert_arbitrator(&env, &arbitrator);
        Self::assert_status(&env, BountyStatus::Disputed);

        let owner: Address = env.storage()
            .instance()
            .get(&symbol_short!("OWNER"))
            .unwrap_or_else(|| env.panic_with_error(ContractError::NotInitialized));
        let contributor: Address = env.storage()
            .instance()
            .get(&symbol_short!("CONTRIB"))
            .unwrap_or_else(|| env.panic_with_error(ContractError::NotInitialized));
        if winner != owner && winner != contributor {
            env.panic_with_error(ContractError::InvalidWinner);
        }

        let amount: i128 = env.storage()
            .instance()
            .get(&symbol_short!("AMOUNT"))
            .unwrap_or_else(|| env.panic_with_error(ContractError::NotInitialized));
        let token_address: Address = env.storage()
            .instance()
            .get(&symbol_short!("TOKEN"))
            .unwrap_or_else(|| env.panic_with_error(ContractError::NotInitialized));
        let token = token::Client::new(&env, &token_address);
        token.transfer(&env.current_contract_address(), &winner, &amount);

        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::Completed);

        env.events().publish((symbol_short!("resolve"), winner), ());
    }

    // --- getters (with safe error handling) ---

    pub fn get_owner(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&symbol_short!("OWNER"))
            .unwrap_or_else(|| env.panic_with_error(ContractError::NotInitialized))
    }

    pub fn get_amount(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&symbol_short!("AMOUNT"))
            .unwrap_or_else(|| env.panic_with_error(ContractError::NotInitialized))
    }

    pub fn get_status(env: Env) -> BountyStatus {
        env.storage()
            .instance()
            .get(&symbol_short!("STATUS"))
            .unwrap_or_else(|| env.panic_with_error(ContractError::NotInitialized))
    }

    pub fn get_contributor(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&symbol_short!("CONTRIB"))
            .unwrap_or_else(|| env.panic_with_error(ContractError::NotInitialized))
    }

    pub fn get_token(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&symbol_short!("TOKEN"))
            .unwrap_or_else(|| env.panic_with_error(ContractError::NotInitialized))
    }

    pub fn get_arbitrator(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&symbol_short!("ARBITRATR"))
            .unwrap_or_else(|| env.panic_with_error(ContractError::NotInitialized))
    }

    // --- safe internal helpers using panic_with_error ---

    fn assert_owner(env: &Env, caller: &Address) {
        let owner: Address = env.storage()
            .instance()
            .get(&symbol_short!("OWNER"))
            .unwrap_or_else(|| env.panic_with_error(ContractError::NotInitialized));
        if caller != &owner {
            env.panic_with_error(ContractError::NotOwner);
        }
    }

    fn assert_contributor(env: &Env, caller: &Address) {
        let contributor: Address = env.storage()
            .instance()
            .get(&symbol_short!("CONTRIB"))
            .unwrap_or_else(|| env.panic_with_error(ContractError::NotInitialized));
        if caller != &contributor {
            env.panic_with_error(ContractError::NotContributor);
        }
    }

    fn assert_arbitrator(env: &Env, caller: &Address) {
        let arbitrator: Address = env.storage()
            .instance()
            .get(&symbol_short!("ARBITRATR"))
            .unwrap_or_else(|| env.panic_with_error(ContractError::NotInitialized));
        if caller != &arbitrator {
            env.panic_with_error(ContractError::NotArbitrator);
        }
    }

    fn assert_status(env: &Env, expected: BountyStatus) {
        let status: BountyStatus = env.storage()
            .instance()
            .get(&symbol_short!("STATUS"))
            .unwrap_or_else(|| env.panic_with_error(ContractError::NotInitialized));
        if status != expected {
            env.panic_with_error(ContractError::InvalidStatus);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::token::{StellarAssetClient, TokenClient};
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Address, Env};

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
        env.budget().reset_unlimited();
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

        (
            env,
            client,
            owner,
            token_address,
            contract_id,
            arbitrator,
            amount,
        )
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
        client.initialize(&owner, &amount, &token_address, &arbitrator);
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
        client.initialize(&owner, &amount, &token_address, &arbitrator);
        assert_eq!(client.get_owner(), owner);
        assert_eq!(client.get_amount(), amount);
        assert_eq!(client.get_token(), token_address);
        assert_eq!(client.get_arbitrator(), arbitrator);
        assert_eq!(client.get_status(), BountyStatus::Created);
    }

    #[test]
    #[should_panic(expected = "HostError: Error(Contract, #9)")]
    fn test_initialize_rejects_zero_amount() {
        let (_, client, owner, token_address, _, arbitrator, _) = setup();
        client.initialize(&owner, &0, &token_address, &arbitrator);
    }

    #[test]
    #[should_panic(expected = "HostError: Error(Contract, #9)")]
    fn test_initialize_rejects_negative_amount() {
        let (_, client, owner, token_address, _, arbitrator, _) = setup();
        client.initialize(&owner, &-1, &token_address, &arbitrator);
    }

    #[test]
    #[should_panic(expected = "HostError: Error(Contract, #2)")]
    fn test_reinitialize_after_deploy_panics_to_protect_upgrade_state() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator);

        let new_owner = Address::generate(&env);
        let new_arbitrator = Address::generate(&env);
        client.initialize(&new_owner, &500, &token_address, &new_arbitrator);
    }

    #[test]
    fn test_fund_transfers_tokens_and_transitions() {
        let (env, client, owner, token_address, contract_id, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator);

        let token = TokenClient::new(&env, &token_address);
        assert_eq!(token.balance(&owner), amount);

        client.fund(&owner);

        assert_eq!(client.get_status(), BountyStatus::Funded);
        assert_eq!(token.balance(&owner), 0);
        assert_eq!(token.balance(&contract_id), amount);
    }

    #[test]
    #[should_panic(expected = "HostError: Error(Contract, #4)")]
    fn test_fund_by_non_owner_panics() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator);

        let not_owner = Address::generate(&env);
        client.fund(&not_owner);
    }

    #[test]
    #[should_panic]
    fn test_fund_with_insufficient_allowance_panics() {
        let (env, client, owner, token_address, contract_id, arbitrator, amount) = setup();
        let token = TokenClient::new(&env, &token_address);
        token.approve(&owner, &contract_id, &(amount - 1), &200);

        client.initialize(&owner, &amount, &token_address, &arbitrator);
        client.fund(&owner);
    }

    #[test]
    fn test_approve_pays_contributor() {
        let (env, client, owner, token_address, contract_id, _arbitrator, contributor, amount) =
            setup_under_review();

        let token = TokenClient::new(&env, &token_address);
        assert_eq!(token.balance(&contract_id), amount);

        client.approve(&owner);

        assert_eq!(client.get_status(), BountyStatus::Completed);
        assert_eq!(token.balance(&contributor), amount);
        assert_eq!(token.balance(&contract_id), 0);
    }

    #[test]
    fn test_cancel_from_funded_refunds_owner() {
        let (env, client, owner, token_address, contract_id, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator);
        client.fund(&owner);

        let token = TokenClient::new(&env, &token_address);
        assert_eq!(token.balance(&contract_id), amount);
        assert_eq!(token.balance(&owner), 0);

        client.cancel(&owner);

        assert_eq!(client.get_status(), BountyStatus::Cancelled);
        assert_eq!(token.balance(&owner), amount);
        assert_eq!(token.balance(&contract_id), 0);
    }

    #[test]
    fn test_cancel_from_created_no_transfer() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator);

        let token = TokenClient::new(&env, &token_address);
        let owner_balance_before = token.balance(&owner);

        client.cancel(&owner);

        assert_eq!(client.get_status(), BountyStatus::Cancelled);
        assert_eq!(token.balance(&owner), owner_balance_before);
    }

    #[test]
    fn test_start_work_transitions_to_in_progress() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator);
        client.fund(&owner);
        let contributor = Address::generate(&env);
        client.start_work(&contributor);
        assert_eq!(client.get_status(), BountyStatus::InProgress);
        assert_eq!(client.get_contributor(), contributor);
    }

    #[test]
    #[should_panic(expected = "HostError: Error(Contract, #7)")]
    fn test_start_work_before_funding_panics() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator);

        let contributor = Address::generate(&env);
        client.start_work(&contributor);
    }

    #[test]
    fn test_submit_transitions_to_under_review() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator);
        client.fund(&owner);
        let contributor = Address::generate(&env);
        client.start_work(&contributor);
        client.submit(&contributor);
        assert_eq!(client.get_status(), BountyStatus::UnderReview);
    }

    #[test]
    #[should_panic(expected = "HostError: Error(Contract, #5)")]
    fn test_submit_by_non_contributor_panics() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator);
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
    fn test_resolve_pays_contributor_and_completes() {
        let (env, client, _, token_address, contract_id, arbitrator, contributor, amount) =
            setup_under_review();
        client.dispute(&contributor);

        let token = TokenClient::new(&env, &token_address);
        assert_eq!(token.balance(&contract_id), amount);

        client.resolve(&arbitrator, &contributor);

        assert_eq!(client.get_status(), BountyStatus::Completed);
        assert_eq!(token.balance(&contributor), amount);
        assert_eq!(token.balance(&contract_id), 0);
    }

    #[test]
    fn test_resolve_pays_owner_and_completes() {
        let (env, client, owner, token_address, contract_id, arbitrator, contributor, amount) =
            setup_under_review();
        client.dispute(&contributor);

        let token = TokenClient::new(&env, &token_address);
        client.resolve(&arbitrator, &owner);

        assert_eq!(client.get_status(), BountyStatus::Completed);
        assert_eq!(token.balance(&owner), amount);
        assert_eq!(token.balance(&contract_id), 0);
    }

    #[test]
    #[should_panic(expected = "HostError: Error(Contract, #3)")]
    fn test_dispute_by_stranger_panics() {
        let (env, client, _, _, _, _, _, _) = setup_under_review();
        let stranger = Address::generate(&env);
        client.dispute(&stranger);
    }

    #[test]
    #[should_panic(expected = "HostError: Error(Contract, #7)")]
    fn test_dispute_wrong_status_panics() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator);
        client.fund(&owner);
        let contributor = Address::generate(&env);
        client.start_work(&contributor);
        // Still InProgress, not UnderReview
        client.dispute(&owner);
    }

    #[test]
    #[should_panic(expected = "HostError: Error(Contract, #6)")]
    fn test_resolve_by_non_arbitrator_panics() {
        let (env, client, _, _, _, _, contributor, _) = setup_under_review();
        client.dispute(&contributor);
        let stranger = Address::generate(&env);
        client.resolve(&stranger, &contributor);
    }

    #[test]
    #[should_panic(expected = "HostError: Error(Contract, #8)")]
    fn test_resolve_with_invalid_winner_panics() {
        let (env, client, _, _, _, arbitrator, contributor, _) = setup_under_review();
        client.dispute(&contributor);
        let stranger = Address::generate(&env);
        client.resolve(&arbitrator, &stranger);
    }

    #[test]
    #[should_panic(expected = "HostError: Error(Contract, #4)")]
    fn test_approve_unauthorized_panics() {
        let (env, client, _, _, _, _, _, _) = setup_under_review();
        let not_owner = Address::generate(&env);
        client.approve(&not_owner);
    }

    #[test]
    #[should_panic(expected = "HostError: Error(Contract, #7)")]
    fn test_approve_before_submit_panics() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator);
        client.fund(&owner);
        let contributor = Address::generate(&env);
        client.start_work(&contributor);

        client.approve(&owner);
    }

    #[test]
    #[should_panic(expected = "HostError: Error(Contract, #7)")]
    fn test_cancel_from_in_progress_panics() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator);
        client.fund(&owner);
        let contributor = Address::generate(&env);
        client.start_work(&contributor);
        client.cancel(&owner);
    }

    #[test]
    #[should_panic(expected = "HostError: Error(Contract, #7)")]
    fn test_double_fund_panics() {
        let (_, client, owner, token_address, _, arbitrator, amount) = setup();
        client.initialize(&owner, &amount, &token_address, &arbitrator);
        client.fund(&owner);
        client.fund(&owner);
    }

    #[test]
    #[should_panic(expected = "HostError: Error(Contract, #7)")]
    fn test_resolve_before_dispute_panics() {
        let (_, client, _, _, _, arbitrator, contributor, _) = setup_under_review();
        client.resolve(&arbitrator, &contributor);
    }
}
