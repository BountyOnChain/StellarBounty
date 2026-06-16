#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, token, Address, Env, Vec};

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
    /// Initialize a bounty. Sets owner, amount, token address, arbitrator, and status to Created.
    pub fn initialize(
        env: Env,
        owner: Address,
        amount: i128,
        token_address: Address,
        arbitrator: Address,
        signers: Vec<Address>,
        threshold: u32,
    ) {
        owner.require_auth();
        assert!(amount > 0, "amount must be positive");
        Self::validate_signer_config(&env, &signers, threshold);
        assert!(
            !env.storage().instance().has(&symbol_short!("STATUS")),
            "contract already initialized"
        );
        env.storage().instance().set(&symbol_short!("OWNER"), &owner);
        env.storage().instance().set(&symbol_short!("AMOUNT"), &amount);
        env.storage().instance().set(&symbol_short!("TOKEN"), &token_address);
        env.storage().instance().set(&symbol_short!("ARBITRATR"), &arbitrator);
        env.storage().instance().set(&symbol_short!("SIGNERS"), &signers);
        env.storage().instance().set(&symbol_short!("THRESH"), &threshold);
        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::Created);
    }

    /// Fund the bounty. Transfers `amount` tokens from owner into the contract.
    /// Transitions Created → Funded.
    pub fn fund(env: Env, owner: Address, signers: Vec<Address>) {
        Self::assert_threshold_authorized(&env, &signers);
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
    pub fn approve(env: Env, owner: Address, signers: Vec<Address>) {
        Self::assert_threshold_authorized(&env, &signers);
        Self::assert_owner(&env, &owner);
        Self::assert_status(&env, BountyStatus::UnderReview, "approve requires UnderReview status");

        let amount: i128 = env.storage().instance().get(&symbol_short!("AMOUNT")).unwrap();
        let token_address: Address = env.storage().instance().get(&symbol_short!("TOKEN")).unwrap();
        let contributor: Address = env.storage().instance().get(&symbol_short!("CONTRIB")).unwrap();
        let token = token::Client::new(&env, &token_address);
        token.transfer(&env.current_contract_address(), &contributor, &amount);

        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::Completed);
    }

    /// Owner cancels and gets a refund. Only valid from Created or Funded.
    pub fn cancel(env: Env, owner: Address, signers: Vec<Address>) {
        Self::assert_threshold_authorized(&env, &signers);
        Self::assert_owner(&env, &owner);
        let status: BountyStatus = env.storage().instance().get(&symbol_short!("STATUS")).unwrap();
        assert!(
            status == BountyStatus::Created || status == BountyStatus::Funded,
            "cancel only allowed from Created or Funded"
        );

        if status == BountyStatus::Funded {
            let amount: i128 = env.storage().instance().get(&symbol_short!("AMOUNT")).unwrap();
            let token_address: Address = env.storage().instance().get(&symbol_short!("TOKEN")).unwrap();
            let token = token::Client::new(&env, &token_address);
            token.transfer(&env.current_contract_address(), &owner, &amount);
        }

        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::Cancelled);
    }

    /// Update owner-operation signers. Requires the current threshold.
    pub fn update_signers(env: Env, signers: Vec<Address>, new_signers: Vec<Address>, new_threshold: u32) {
        Self::assert_threshold_authorized(&env, &signers);
        Self::validate_signer_config(&env, &new_signers, new_threshold);

        env.storage().instance().set(&symbol_short!("SIGNERS"), &new_signers);
        env.storage().instance().set(&symbol_short!("THRESH"), &new_threshold);
        env.events()
            .publish((symbol_short!("signers"), symbol_short!("update")), new_threshold);
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

        let amount: i128 = env.storage().instance().get(&symbol_short!("AMOUNT")).unwrap();
        let token_address: Address = env.storage().instance().get(&symbol_short!("TOKEN")).unwrap();
        let token = token::Client::new(&env, &token_address);
        token.transfer(&env.current_contract_address(), &winner, &amount);

        env.storage()
            .instance()
            .set(&symbol_short!("STATUS"), &BountyStatus::Completed);

        env.events().publish((symbol_short!("resolve"), winner), ());
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

    pub fn get_signers(env: Env) -> Vec<Address> {
        env.storage().instance().get(&symbol_short!("SIGNERS")).unwrap()
    }

    pub fn get_threshold(env: Env) -> u32 {
        env.storage().instance().get(&symbol_short!("THRESH")).unwrap()
    }

    // --- helpers ---

    fn validate_signer_config(env: &Env, signers: &Vec<Address>, threshold: u32) {
        assert!(!signers.is_empty(), "at least one signer required");
        assert!(threshold > 0, "threshold must be positive");
        assert!(threshold <= signers.len(), "threshold exceeds signer count");

        let mut unique = Vec::new(env);
        for signer in signers.iter() {
            assert!(!Self::contains_address(&unique, &signer), "duplicate signer");
            unique.push_back(signer);
        }
    }

    fn assert_threshold_authorized(env: &Env, provided_signers: &Vec<Address>) {
        let configured_signers: Vec<Address> = env.storage().instance().get(&symbol_short!("SIGNERS")).unwrap();
        let threshold: u32 = env.storage().instance().get(&symbol_short!("THRESH")).unwrap();
        let mut approved = Vec::new(env);

        for signer in provided_signers.iter() {
            if Self::contains_address(&configured_signers, &signer) && !Self::contains_address(&approved, &signer) {
                signer.require_auth();
                approved.push_back(signer);
            }
        }

        assert!(approved.len() >= threshold, "insufficient signer approvals");
    }

    fn contains_address(signers: &Vec<Address>, target: &Address) -> bool {
        for signer in signers.iter() {
            if &signer == target {
                return true;
            }
        }

        false
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
        testutils::Address as _,
        token::{Client as TokenClient, StellarAssetClient},
        Address, Env, Vec,
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

    fn signer_vec(env: &Env, signers: &[Address]) -> Vec<Address> {
        let mut signer_vec = Vec::new(env);
        for signer in signers {
            signer_vec.push_back(signer.clone());
        }
        signer_vec
    }

    fn owner_signers(env: &Env, owner: &Address) -> Vec<Address> {
        signer_vec(env, &[owner.clone()])
    }

    fn initialize_single(
        env: &Env,
        client: &EscrowContractClient,
        owner: &Address,
        amount: &i128,
        token_address: &Address,
        arbitrator: &Address,
    ) {
        let signers = owner_signers(env, owner);
        client.initialize(owner, amount, token_address, arbitrator, &signers, &1);
    }

    fn fund_as_owner(env: &Env, client: &EscrowContractClient, owner: &Address) {
        let signers = owner_signers(env, owner);
        client.fund(owner, &signers);
    }

    fn approve_as_owner(env: &Env, client: &EscrowContractClient, owner: &Address) {
        let signers = owner_signers(env, owner);
        client.approve(owner, &signers);
    }

    fn cancel_as_owner(env: &Env, client: &EscrowContractClient, owner: &Address) {
        let signers = owner_signers(env, owner);
        client.cancel(owner, &signers);
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
        initialize_single(&env, &client, &owner, &amount, &token_address, &arbitrator);
        fund_as_owner(&env, &client, &owner);
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
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        initialize_single(&env, &client, &owner, &amount, &token_address, &arbitrator);
        assert_eq!(client.get_owner(), owner);
        assert_eq!(client.get_amount(), amount);
        assert_eq!(client.get_token(), token_address);
        assert_eq!(client.get_arbitrator(), arbitrator);
        assert_eq!(client.get_signers().len(), 1);
        assert_eq!(client.get_threshold(), 1);
        assert_eq!(client.get_status(), BountyStatus::Created);
    }

    #[test]
    #[should_panic(expected = "amount must be positive")]
    fn test_initialize_rejects_zero_amount() {
        let (env, client, owner, token_address, _, arbitrator, _) = setup();
        initialize_single(&env, &client, &owner, &0, &token_address, &arbitrator);
    }

    #[test]
    #[should_panic(expected = "amount must be positive")]
    fn test_initialize_rejects_negative_amount() {
        let (env, client, owner, token_address, _, arbitrator, _) = setup();
        initialize_single(&env, &client, &owner, &-1, &token_address, &arbitrator);
    }

    #[test]
    #[should_panic(expected = "contract already initialized")]
    fn test_reinitialize_after_deploy_panics_to_protect_upgrade_state() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        initialize_single(&env, &client, &owner, &amount, &token_address, &arbitrator);

        let new_owner = Address::generate(&env);
        let new_arbitrator = Address::generate(&env);
        initialize_single(&env, &client, &new_owner, &500, &token_address, &new_arbitrator);
    }

    #[test]
    fn test_fund_transfers_tokens_and_transitions() {
        let (env, client, owner, token_address, contract_id, arbitrator, amount) = setup();
        initialize_single(&env, &client, &owner, &amount, &token_address, &arbitrator);

        let token = TokenClient::new(&env, &token_address);
        assert_eq!(token.balance(&owner), amount);

        fund_as_owner(&env, &client, &owner);

        assert_eq!(client.get_status(), BountyStatus::Funded);
        assert_eq!(token.balance(&owner), 0);
        assert_eq!(token.balance(&contract_id), amount);
    }

    #[test]
    #[should_panic(expected = "only owner can call this")]
    fn test_fund_by_non_owner_panics() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        initialize_single(&env, &client, &owner, &amount, &token_address, &arbitrator);

        let not_owner = Address::generate(&env);
        let signers = owner_signers(&env, &owner);
        client.fund(&not_owner, &signers);
    }

    #[test]
    #[should_panic]
    fn test_fund_with_insufficient_allowance_panics() {
        let (env, client, owner, token_address, contract_id, arbitrator, amount) = setup();
        let token = TokenClient::new(&env, &token_address);
        token.approve(&owner, &contract_id, &(amount - 1), &200);

        initialize_single(&env, &client, &owner, &amount, &token_address, &arbitrator);
        fund_as_owner(&env, &client, &owner);
    }

    #[test]
    fn test_approve_pays_contributor() {
        let (env, client, owner, token_address, contract_id, _arbitrator, contributor, amount) = setup_under_review();

        let token = TokenClient::new(&env, &token_address);
        assert_eq!(token.balance(&contract_id), amount);

        approve_as_owner(&env, &client, &owner);

        assert_eq!(client.get_status(), BountyStatus::Completed);
        assert_eq!(token.balance(&contributor), amount);
        assert_eq!(token.balance(&contract_id), 0);
    }

    #[test]
    fn test_cancel_from_funded_refunds_owner() {
        let (env, client, owner, token_address, contract_id, arbitrator, amount) = setup();
        initialize_single(&env, &client, &owner, &amount, &token_address, &arbitrator);
        fund_as_owner(&env, &client, &owner);

        let token = TokenClient::new(&env, &token_address);
        assert_eq!(token.balance(&contract_id), amount);
        assert_eq!(token.balance(&owner), 0);

        cancel_as_owner(&env, &client, &owner);

        assert_eq!(client.get_status(), BountyStatus::Cancelled);
        assert_eq!(token.balance(&owner), amount);
        assert_eq!(token.balance(&contract_id), 0);
    }

    #[test]
    fn test_cancel_from_created_no_transfer() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        initialize_single(&env, &client, &owner, &amount, &token_address, &arbitrator);

        let token = TokenClient::new(&env, &token_address);
        let owner_balance_before = token.balance(&owner);

        cancel_as_owner(&env, &client, &owner);

        assert_eq!(client.get_status(), BountyStatus::Cancelled);
        assert_eq!(token.balance(&owner), owner_balance_before);
    }

    #[test]
    fn test_start_work_transitions_to_in_progress() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        initialize_single(&env, &client, &owner, &amount, &token_address, &arbitrator);
        fund_as_owner(&env, &client, &owner);
        let contributor = Address::generate(&env);
        client.start_work(&contributor);
        assert_eq!(client.get_status(), BountyStatus::InProgress);
        assert_eq!(client.get_contributor(), contributor);
    }

    #[test]
    #[should_panic(expected = "start_work requires Funded status")]
    fn test_start_work_before_funding_panics() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        initialize_single(&env, &client, &owner, &amount, &token_address, &arbitrator);

        let contributor = Address::generate(&env);
        client.start_work(&contributor);
    }

    #[test]
    fn test_submit_transitions_to_under_review() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        initialize_single(&env, &client, &owner, &amount, &token_address, &arbitrator);
        fund_as_owner(&env, &client, &owner);
        let contributor = Address::generate(&env);
        client.start_work(&contributor);
        client.submit(&contributor);
        assert_eq!(client.get_status(), BountyStatus::UnderReview);
    }

    #[test]
    #[should_panic(expected = "only contributor can call this")]
    fn test_submit_by_non_contributor_panics() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        initialize_single(&env, &client, &owner, &amount, &token_address, &arbitrator);
        fund_as_owner(&env, &client, &owner);
        let contributor = Address::generate(&env);
        client.start_work(&contributor);

        let not_contributor = Address::generate(&env);
        client.submit(&not_contributor);
    }

    #[test]
    fn test_two_of_three_multisig_approve_succeeds() {
        let (env, client, owner, token_address, contract_id, arbitrator, amount) = setup();
        let signer_a = Address::generate(&env);
        let signer_b = Address::generate(&env);
        let signer_c = Address::generate(&env);
        let configured_signers = signer_vec(&env, &[signer_a.clone(), signer_b.clone(), signer_c.clone()]);
        client.initialize(&owner, &amount, &token_address, &arbitrator, &configured_signers, &2);

        let approving_signers = signer_vec(&env, &[signer_a.clone(), signer_b.clone()]);
        client.fund(&owner, &approving_signers);
        let contributor = Address::generate(&env);
        client.start_work(&contributor);
        client.submit(&contributor);
        client.approve(&owner, &approving_signers);

        let token = TokenClient::new(&env, &token_address);
        assert_eq!(client.get_status(), BountyStatus::Completed);
        assert_eq!(token.balance(&contributor), amount);
        assert_eq!(token.balance(&contract_id), 0);
    }

    #[test]
    #[should_panic(expected = "insufficient signer approvals")]
    fn test_two_of_three_multisig_one_signature_fails() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        let signer_a = Address::generate(&env);
        let signer_b = Address::generate(&env);
        let signer_c = Address::generate(&env);
        let configured_signers = signer_vec(&env, &[signer_a.clone(), signer_b.clone(), signer_c.clone()]);
        client.initialize(&owner, &amount, &token_address, &arbitrator, &configured_signers, &2);

        let approving_signers = signer_vec(&env, &[signer_a.clone(), signer_b]);
        client.fund(&owner, &approving_signers);
        let contributor = Address::generate(&env);
        client.start_work(&contributor);
        client.submit(&contributor);

        let insufficient_signers = signer_vec(&env, &[signer_a]);
        client.approve(&owner, &insufficient_signers);
    }

    #[test]
    fn test_update_signers_rotates_owner_threshold() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        let signer_a = Address::generate(&env);
        let signer_b = Address::generate(&env);
        let signer_c = Address::generate(&env);
        let initial_signers = signer_vec(&env, &[signer_a.clone(), signer_b.clone(), signer_c.clone()]);
        client.initialize(&owner, &amount, &token_address, &arbitrator, &initial_signers, &2);

        let signer_d = Address::generate(&env);
        let signer_e = Address::generate(&env);
        let signer_f = Address::generate(&env);
        let current_approvals = signer_vec(&env, &[signer_a, signer_b]);
        let new_signers = signer_vec(&env, &[signer_d.clone(), signer_e.clone(), signer_f.clone()]);
        client.update_signers(&current_approvals, &new_signers, &2);

        assert_eq!(client.get_threshold(), 2);
        assert_eq!(client.get_signers(), new_signers);

        let new_approvals = signer_vec(&env, &[signer_d, signer_e]);
        client.fund(&owner, &new_approvals);
        assert_eq!(client.get_status(), BountyStatus::Funded);
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
        let (env, client, _, token_address, contract_id, arbitrator, contributor, amount) = setup_under_review();
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
        let (env, client, owner, token_address, contract_id, arbitrator, contributor, amount) = setup_under_review();
        client.dispute(&contributor);

        let token = TokenClient::new(&env, &token_address);
        client.resolve(&arbitrator, &owner);

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
        initialize_single(&env, &client, &owner, &amount, &token_address, &arbitrator);
        fund_as_owner(&env, &client, &owner);
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
        let (env, client, owner, _, _, _, _, _) = setup_under_review();
        let not_owner = Address::generate(&env);
        let signers = owner_signers(&env, &owner);
        client.approve(&not_owner, &signers);
    }

    #[test]
    #[should_panic(expected = "approve requires UnderReview status")]
    fn test_approve_before_submit_panics() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        initialize_single(&env, &client, &owner, &amount, &token_address, &arbitrator);
        fund_as_owner(&env, &client, &owner);
        let contributor = Address::generate(&env);
        client.start_work(&contributor);

        approve_as_owner(&env, &client, &owner);
    }

    #[test]
    #[should_panic(expected = "cancel only allowed from Created or Funded")]
    fn test_cancel_from_in_progress_panics() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        initialize_single(&env, &client, &owner, &amount, &token_address, &arbitrator);
        fund_as_owner(&env, &client, &owner);
        let contributor = Address::generate(&env);
        client.start_work(&contributor);
        cancel_as_owner(&env, &client, &owner);
    }

    #[test]
    #[should_panic(expected = "fund requires Created status")]
    fn test_double_fund_panics() {
        let (env, client, owner, token_address, _, arbitrator, amount) = setup();
        initialize_single(&env, &client, &owner, &amount, &token_address, &arbitrator);
        fund_as_owner(&env, &client, &owner);
        fund_as_owner(&env, &client, &owner);
    }

    #[test]
    #[should_panic(expected = "resolve requires Disputed status")]
    fn test_resolve_before_dispute_panics() {
        let (_, client, _, _, _, arbitrator, contributor, _) = setup_under_review();
        client.resolve(&arbitrator, &contributor);
    }
}
