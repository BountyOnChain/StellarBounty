"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { clearAuthToken } from "@/lib/api";

type WalletState = {
  publicKey: string | null;
  freighterNetwork: string | null;
  targetNetwork: string;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
};

type FreighterApi = typeof import("@stellar/freighter-api");

const WALLET_STORAGE_KEY = "stellar-bounty.wallet";
const DEFAULT_NETWORK = "TESTNET";

const WalletContext = createContext<WalletState | undefined>(undefined);

type StoredWallet = {
  publicKey: string;
  freighterNetwork: string | null;
};

function normalizeNetwork(network: string | undefined) {
  return (network || DEFAULT_NETWORK).trim().toUpperCase();
}

function formatFreighterError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to connect to Freighter.";
}

async function loadFreighter(): Promise<FreighterApi> {
  return import("@stellar/freighter-api");
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [freighterNetwork, setFreighterNetwork] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetNetwork = normalizeNetwork(process.env.NEXT_PUBLIC_STELLAR_NETWORK);

  useEffect(() => {
    const savedWallet = window.localStorage.getItem(WALLET_STORAGE_KEY);

    if (!savedWallet) {
      return;
    }

    try {
      const parsedWallet = JSON.parse(savedWallet) as StoredWallet;

      if (parsedWallet?.publicKey) {
        setPublicKey(parsedWallet.publicKey);
        setFreighterNetwork(parsedWallet.freighterNetwork);
      }
    } catch {
      window.localStorage.removeItem(WALLET_STORAGE_KEY);
    }
  }, []);

  const disconnect = useCallback(() => {
    window.localStorage.removeItem(WALLET_STORAGE_KEY);
    clearAuthToken();
    setPublicKey(null);
    setFreighterNetwork(null);
    setError(null);
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const freighter = await loadFreighter();
      const connection = await freighter.isConnected();

      if (connection.error || !connection.isConnected) {
        setError("Freighter is not installed.");
        return;
      }

      const access = await freighter.requestAccess();

      if (access.error || !access.address) {
        setError(access.error?.message || "Freighter did not return a public key.");
        return;
      }

      const network = await freighter.getNetwork();

      if (network.error) {
        setError(network.error.message);
        return;
      }

      const activeNetwork = normalizeNetwork(network.network);

      setPublicKey(access.address);
      setFreighterNetwork(activeNetwork);
      window.localStorage.setItem(
        WALLET_STORAGE_KEY,
        JSON.stringify({ publicKey: access.address, freighterNetwork: activeNetwork }),
      );

      if (activeNetwork !== targetNetwork) {
        setError(`Freighter is on ${activeNetwork}. This app is configured for ${targetNetwork}.`);
      }
    } catch (caughtError) {
      setError(formatFreighterError(caughtError));
    } finally {
      setIsConnecting(false);
    }
  }, [targetNetwork]);

  const value = useMemo(
    () => ({
      publicKey,
      freighterNetwork,
      targetNetwork,
      isConnecting,
      error,
      connect,
      disconnect,
    }),
    [connect, disconnect, error, freighterNetwork, isConnecting, publicKey, targetNetwork],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const wallet = useContext(WalletContext);

  if (!wallet) {
    throw new Error("useWallet must be used inside WalletProvider");
  }

  return wallet;
}
