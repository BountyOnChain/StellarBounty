import { clearStoredWalletSession, WALLET_STORAGE_KEY } from "./wallet-storage";

const TOKEN_STORAGE_KEY = "stellar-bounty.auth-token";

function createLocalStorage(): Storage {
  const store = new Map<string, string>();

  return {
    getItem: jest.fn((key: string) => store.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: jest.fn((key: string) => {
      store.delete(key);
    }),
    clear: jest.fn(() => {
      store.clear();
    }),
    key: jest.fn((index: number) => Array.from(store.keys())[index] ?? null),
    get length() {
      return store.size;
    },
  };
}

describe("wallet session storage", () => {
  let fetchMock: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    Object.defineProperty(global, "window", {
      configurable: true,
      value: {
        localStorage: createLocalStorage(),
      },
    });

    fetchMock = jest.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock;
  });

  it("clears both wallet and auth storage on disconnect", async () => {
    window.localStorage.setItem(
      WALLET_STORAGE_KEY,
      JSON.stringify({ publicKey: "GACTIVE", freighterNetwork: "TESTNET" }),
    );
    window.localStorage.setItem(TOKEN_STORAGE_KEY, "jwt");

    await clearStoredWalletSession();

    expect(window.localStorage.getItem(WALLET_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it("calls POST /api/v1/auth/revoke with the stored token", async () => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, "my-jwt-token");
    window.localStorage.setItem(
      WALLET_STORAGE_KEY,
      JSON.stringify({ publicKey: "GACTIVE", freighterNetwork: "TESTNET" }),
    );

    await clearStoredWalletSession();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/auth/revoke"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "my-jwt-token" }),
      }),
    );
  });

  it("clears local storage even when the revoke network call fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network error"));
    window.localStorage.setItem(TOKEN_STORAGE_KEY, "my-jwt-token");
    window.localStorage.setItem(
      WALLET_STORAGE_KEY,
      JSON.stringify({ publicKey: "GACTIVE", freighterNetwork: "TESTNET" }),
    );

    // Should not throw
    await expect(clearStoredWalletSession()).resolves.toBeUndefined();

    expect(window.localStorage.getItem(WALLET_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it("does not call revoke when there is no stored token", async () => {
    window.localStorage.setItem(
      WALLET_STORAGE_KEY,
      JSON.stringify({ publicKey: "GACTIVE", freighterNetwork: "TESTNET" }),
    );
    // No token in storage

    await clearStoredWalletSession();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(WALLET_STORAGE_KEY)).toBeNull();
  });
});
