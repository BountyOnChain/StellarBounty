"use client";

import { useCallback, useMemo, useState } from "react";
import { signMessage } from "@stellar/freighter-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_STORAGE_KEY = "stellar-bounty.auth-token";
const REFRESH_TOKEN_STORAGE_KEY = "stellar-bounty.refresh-token";

type AuthTokenResponse = {
  accessToken: string;
  refreshToken: string;
};

async function getAccessToken(publicKey: string): Promise<string> {
  const savedToken =
    typeof window !== "undefined"
      ? window.localStorage.getItem(TOKEN_STORAGE_KEY)
      : null;

  if (savedToken) {
    return savedToken;
  }

  const challengeResponse = await fetch(
    `${API_URL}/auth/challenge?address=${encodeURIComponent(publicKey)}`
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
    body: JSON.stringify({
      address: publicKey,
      signature: signed.signedMessage,
      nonce,
    }),
  });

  if (!verifyResponse.ok) {
    throw new Error("Wallet verification failed.");
  }

  const { accessToken, refreshToken } =
    (await verifyResponse.json()) as AuthTokenResponse;
  if (!accessToken || !refreshToken) {
    throw new Error("Verification did not return an access token.");
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  return accessToken;
}

function clearAuthToken(): void {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
}

export function useAuth() {
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const getToken = useCallback(async (publicKey: string): Promise<string> => {
    setIsAuthenticating(true);
    try {
      return await getAccessToken(publicKey);
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  return useMemo(
    () => ({
      getToken,
      clearToken: clearAuthToken,
      isAuthenticating,
      apiUrl: API_URL,
    }),
    [getToken, isAuthenticating]
  );
}
