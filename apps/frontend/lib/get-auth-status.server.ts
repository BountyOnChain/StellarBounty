/**
 * Server-only utility that reads the `auth-token` cookie so the initial
 * render can show the correct connection state instead of a flash of
 * "Connect wallet to view".
 *
 * This file uses Next.js `cookies()` — it MUST only be imported from
 * Server Components (app directory), never from client components.
 */
import { cookies } from "next/headers";

export type AuthStatus = {
  /** Whether a valid auth-token cookie was found */
  hasToken: boolean;
  /** The raw token value, if present */
  token: string | null;
};

export function getAuthStatusFromCookie(): AuthStatus {
  const cookieStore = cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;

  return {
    hasToken: token !== null,
    token,
  };
}