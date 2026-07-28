/**
 * Stellar explorer deep-link utilities.
 *
 * Generates URLs to view on-chain contracts and accounts on
 * the stellar.expert block explorer.
 */

/**
 * Network identifier as used by stellar.expert.
 *
 * - `"testnet"` → `explorer/testnet/…`
 * - `"mainnet"` → `explorer/public/…`
 */
const EXPLORER_NETWORK_SEGMENT: Record<string, string> = {
  testnet: "testnet",
  mainnet: "public",
};

/**
 * Build a stellar.expert URL for an on-chain contract.
 *
 * @param contractId - The contract or account address to look up.
 * @param network    - Stellar network name (`"testnet"` or `"mainnet"`).
 *                     Defaults to `"testnet"`.
 *
 * @example
 *   stellarDeepLink("CA3D…")           // "https://stellar.expert/explorer/testnet/contract/CA3D…"
 *   stellarDeepLink("CA3D…", "mainnet") // "https://stellar.expert/explorer/public/contract/CA3D…"
 */
export function stellarDeepLink(
  contractId: string,
  network: string = "testnet",
): string {
  const segment = EXPLORER_NETWORK_SEGMENT[network.toLowerCase()] ?? "testnet";
  return `https://stellar.expert/explorer/${segment}/contract/${encodeURIComponent(contractId)}`;
}