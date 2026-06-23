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
  beforeEach(() => {
    Object.defineProperty(global, "window", {
      configurable: true,
      value: {
        localStorage: createLocalStorage(),
      },
    });
  });

  it("clears both wallet and auth storage on disconnect", () => {
    window.localStorage.setItem(
      WALLET_STORAGE_KEY,
      JSON.stringify({ publicKey: "GACTIVE", freighterNetwork: "TESTNET" }),
    );
    window.localStorage.setItem(TOKEN_STORAGE_KEY, "jwt");

    clearStoredWalletSession();

    expect(window.localStorage.getItem(WALLET_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });
});
