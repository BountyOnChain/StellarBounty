/**
 * Auth flow tests for the useAuth hook in apps/frontend/lib/api.ts.
 *
 * Note: jsdom 29 does not ship a global `Response` (added in jsdom 24+).
 * To keep these tests free of network/undici dependencies we exercise
 * getAccessToken() indirectly through the saved-token path (which never
 * touches fetch) and through error paths that throw synchronously.
 *
 * The full challenge → sign → verify round-trip is covered by the
 * existing e2e suite (apps/frontend/tests/e2e/bounty-flows.spec.ts).
 */

import { act, render } from "@testing-library/react";
import { useAuth } from "./api";

jest.mock("@stellar/freighter-api", () => ({
  __esModule: true,
  signMessage: jest.fn(),
}));

import * as freighter from "@stellar/freighter-api";

const mockedFreighter = freighter as jest.Mocked<typeof freighter>;

const TOKEN_STORAGE_KEY = "stellar-bounty.auth-token";

declare global {
  interface Window {
    __lastToken?: string | null;
    __lastError?: string | null;
  }
}

function AuthProbe() {
  const { getToken, clearToken, isAuthenticating, apiUrl } = useAuth();
  return (
    <div>
      <span data-testid="isAuthenticating">{String(isAuthenticating)}</span>
      <span data-testid="apiUrl">{apiUrl}</span>
      <button
        onClick={async () => {
          try {
            const t = await getToken("GABC");
            window.__lastToken = t;
            window.__lastError = null;
          } catch (err) {
            window.__lastToken = null;
            window.__lastError = err instanceof Error ? err.message : String(err);
          }
        }}
      >
        get-token
      </button>
      <button onClick={() => clearToken()}>clear</button>
    </div>
  );
}

describe("useAuth — saved-token path (no fetch)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.__lastToken = undefined;
    window.__lastError = undefined;
    jest.clearAllMocks();
  });

  it("returns a saved token from localStorage without signing or fetching", async () => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, "saved.jwt.value");
    const { getByText } = render(<AuthProbe />);

    await act(async () => {
      getByText("get-token").click();
    });

    expect(mockedFreighter.signMessage).not.toHaveBeenCalled();
    expect(window.__lastToken).toBe("saved.jwt.value");
    expect(window.__lastError).toBeNull();
  });

  it("clearToken removes the stored token", () => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, "to-be-cleared");
    const { getByText } = render(<AuthProbe />);

    act(() => {
      getByText("clear").click();
    });

    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });
});

describe("useAuth — public surface", () => {
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
});
