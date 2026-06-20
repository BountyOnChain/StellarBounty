import { signMessage } from "@stellar/freighter-api";
import { clearAuthToken, getAccessToken } from "./api";

jest.mock("@stellar/freighter-api", () => ({
  signMessage: jest.fn(),
}));

const TOKEN_STORAGE_KEY = "stellar-bounty.auth-token";

function createJwt(sub: string): string {
  const payload = Buffer.from(JSON.stringify({ sub })).toString("base64url");
  return `header.${payload}.signature`;
}

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

describe("frontend auth token storage", () => {
  let fetchMock: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    Object.defineProperty(global, "window", {
      configurable: true,
      value: {
        localStorage: createLocalStorage(),
      },
    });

    fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
    global.fetch = fetchMock;
    (signMessage as jest.Mock).mockReset();
  });

  it("reuses a saved JWT only when the subject matches the active public key", async () => {
    const token = createJwt("GACTIVE");
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);

    await expect(getAccessToken("GACTIVE")).resolves.toBe(token);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears a stale JWT and authenticates again for a different public key", async () => {
    const staleToken = createJwt("GOLDWALLET");
    const freshToken = createJwt("GNEWWALLET");
    window.localStorage.setItem(TOKEN_STORAGE_KEY, staleToken);
    (signMessage as jest.Mock).mockResolvedValue({ signedMessage: "signed-nonce" });
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nonce: "nonce" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: freshToken }),
      } as Response);

    await expect(getAccessToken("GNEWWALLET")).resolves.toBe(freshToken);

    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBe(freshToken);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(signMessage).toHaveBeenCalledWith("nonce", { address: "GNEWWALLET" });
  });

  it("exports a clear function for wallet disconnect cleanup", () => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, "token");

    clearAuthToken();

    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });
});
