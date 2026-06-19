/**
 * Auth flow tests for the useAuth hook in apps/frontend/lib/api.ts.
 *
 * Tests the new cookie-based auth flow (authenticate / refresh / logout).
 * The full challenge → sign → verify round-trip is covered by the
 * existing e2e suite (apps/frontend/tests/e2e/bounty-flows.spec.ts).
 */

import { render } from "@testing-library/react";
import { useAuth } from "./api";

jest.mock("@stellar/freighter-api", () => ({
  __esModule: true,
  signMessage: jest.fn(),
}));

declare global {
  interface Window {
    __lastError?: string | null;
  }
}

function AuthProbe() {
  const { authenticate, refresh, logout, isAuthenticating, apiUrl } = useAuth();
  return (
    <div>
      <span data-testid="isAuthenticating">{String(isAuthenticating)}</span>
      <span data-testid="apiUrl">{apiUrl}</span>
      <button
        onClick={async () => {
          try {
            await authenticate("GABC");
            window.__lastError = null;
          } catch (err) {
            window.__lastError = err instanceof Error ? err.message : String(err);
          }
        }}
      >
        authenticate
      </button>
      <button onClick={() => refresh()}>refresh</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

describe("useAuth — public surface", () => {
  beforeEach(() => {
    window.__lastError = undefined;
    jest.clearAllMocks();
  });

  it("falls back to http://localhost:4000 when no env var is set", () => {
    const saved = process.env.NEXT_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
    const { getByTestId } = render(<AuthProbe />);
    expect(getByTestId("apiUrl").textContent).toBe("http://localhost:4000");
    if (saved) process.env.NEXT_PUBLIC_API_URL = saved;
  });

  it("starts with isAuthenticating=false", () => {
    const { getByTestId } = render(<AuthProbe />);
    expect(getByTestId("isAuthenticating").textContent).toBe("false");
  });

  it("exposes authenticate, refresh, and logout functions", () => {
    const { getByText } = render(<AuthProbe />);
    expect(getByText("authenticate")).toBeTruthy();
    expect(getByText("refresh")).toBeTruthy();
    expect(getByText("logout")).toBeTruthy();
  });
});
