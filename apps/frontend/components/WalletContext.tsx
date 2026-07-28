"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clearStoredWalletSession, readStoredWallet, saveStoredWallet } from "./wallet-storage";

type WalletState = {
  publicKey: string | null;
  freighterNetwork: string | null;
  targetNetwork: string;
  isConnecting: boolean;
  error: string | null;
  /** Whether the server detected an auth-token cookie during SSR. */
  hasToken: boolean;
  /** Monotonically increasing version. Increments on every connect and
   *  disconnect so dashboard components can key their data-fetches on it
   *  and automatically refetch after a wallet change. */
  dashboardVersion: number;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

type FreighterApi = typeof import("@stellar/freighter-api");

const DEFAULT_NETWORK = "TESTNET";

const WalletContext = createContext<WalletState | undefined>(undefined);

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

export function WalletProvider({
  children,
  initialHasToken = false,
}: {
  children: React.ReactNode;
  /** Whether the server detected an auth-token cookie during SSR. */
  initialHasToken?: boolean;
}) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [freighterNetwork, setFreighterNetwork] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboardVersion, setDashboardVersion] = useState(0);
  // Use the server-hydrated value so the first paint shows the correct
  // state — no "Connect wallet to view" flash when a token exists.
  const [hasToken, setHasToken] = useState(initialHasToken);

  const targetNetwork = normalizeNetwork(process.env.NEXT_PUBLIC_STELLAR_NETWORK);

  useEffect(() => {
    const savedWallet = readStoredWallet();

    if (!savedWallet) {
      return;
    }

    setPublicKey(savedWallet.publicKey);
    setFreighterNetwork(savedWallet.freighterNetwork);
  }, []);

  const disconnect = useCallback(async () => {
    await clearStoredWalletSession();
    setPublicKey(null);
    setFreighterNetwork(null);
    setError(null);
    // Bump dashboardVersion so consumers know to invalidate their caches.
    setDashboardVersion((v) => v + 1);
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
      saveStoredWallet({ publicKey: access.address, freighterNetwork: activeNetwork });
      // Bump dashboardVersion so all auth-bound data hooks know to refetch.
      setDashboardVersion((v) => v + 1);

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
      hasToken,
      dashboardVersion,
      connect,
      disconnect,
    }),
    [connect, disconnect, dashboardVersion, error, freighterNetwork, hasToken, isConnecting, publicKey, targetNetwork],
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
