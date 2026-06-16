"use client";

import { useCallback, useMemo, useState } from "react";
import { signMessage } from "@stellar/freighter-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_STORAGE_KEY = "stellar-bounty.auth-token";

type AuthTokenResponse = {
  accessToken: string;
};

export function clearAuthToken(): void {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function getAuthTokenSubject(token: string): string | null {
  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  try {
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "=",
    );
    const decodedPayload = JSON.parse(atob(paddedPayload)) as { sub?: unknown };
    return typeof decodedPayload.sub === "string" ? decodedPayload.sub : null;
  } catch {
    return null;
  }
}

async function getAccessToken(publicKey: string): Promise<string> {
  const savedToken =
    typeof window !== "undefined"
      ? window.localStorage.getItem(TOKEN_STORAGE_KEY)
      : null;

  if (savedToken) {
    if (getAuthTokenSubject(savedToken) === publicKey) {
      return savedToken;
    }

    clearAuthToken();
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

  const { accessToken } = (await verifyResponse.json()) as AuthTokenResponse;
  if (!accessToken) {
    throw new Error("Verification did not return an access token.");
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
  return accessToken;
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
