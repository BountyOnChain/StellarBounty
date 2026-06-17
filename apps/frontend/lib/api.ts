"use client";

import { useCallback, useMemo, useState } from "react";
import { signMessage } from "@stellar/freighter-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function ensureAuthenticated(publicKey: string): Promise<void> {
  // Check if we have a valid access token by making a test request
  // The browser will automatically send httpOnly cookies
  const challengeResponse = await fetch(
    `${API_URL}/auth/challenge?address=${encodeURIComponent(publicKey)}`,
    { credentials: "include" }
  );
  if (!challengeResponse.ok) {
    throw new Error("Failed to request wallet challenge.");
  }

  const { nonce } = (await challengeResponse.json()) as { nonce?: string };
  if (!nonce) {
    throw new Error("Challenge response was missing a nonce.");
  }

  const signed = await signMessage(nonce, { address: publicKey });
  if (signed.error || !signed.signedMessage) {
    throw new Error(signed.error?.message || "Wallet signature was cancelled.");
  }

  const verifyResponse = await fetch(`${API_URL}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      address: publicKey,
      signature: signed.signedMessage,
      nonce,
    }),
  });

  if (!verifyResponse.ok) {
    throw new Error("Wallet verification failed.");
  }
}

async function refreshAccessToken(): Promise<void> {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Session expired. Please reconnect your wallet.");
  }
}

async function clearAuthCookies(): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

export function useAuth() {
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const authenticate = useCallback(async (publicKey: string): Promise<void> => {
    setIsAuthenticating(true);
    try {
      await ensureAuthenticated(publicKey);
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    await refreshAccessToken();
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await clearAuthCookies();
  }, []);

  return useMemo(
    () => ({
      authenticate,
      refresh,
      logout,
      isAuthenticating,
      apiUrl: API_URL,
    }),
    [authenticate, refresh, logout, isAuthenticating]
  );
}
