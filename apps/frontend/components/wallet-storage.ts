import { clearAuthToken } from "../lib/api";

export const WALLET_STORAGE_KEY = "stellar-bounty.wallet";

export type StoredWallet = {
  publicKey: string;
  freighterNetwork: string | null;
};

export function readStoredWallet(): StoredWallet | null {
  const savedWallet = window.localStorage.getItem(WALLET_STORAGE_KEY);

  if (!savedWallet) {
    return null;
  }

  try {
    const parsedWallet = JSON.parse(savedWallet) as StoredWallet;
    return parsedWallet?.publicKey ? parsedWallet : null;
  } catch {
    window.localStorage.removeItem(WALLET_STORAGE_KEY);
    return null;
  }
}

export function saveStoredWallet(wallet: StoredWallet): void {
  window.localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(wallet));
}

export function clearStoredWalletSession(): void {
  window.localStorage.removeItem(WALLET_STORAGE_KEY);
  clearAuthToken();
}
