import { act, renderHook } from "@testing-library/react";
import { signMessage } from "@stellar/freighter-api";
import { useAuth } from "./api";

jest.mock("@stellar/freighter-api", () => ({
  signMessage: jest.fn(),
}));

const TOKEN_STORAGE_KEY = "stellar-bounty.auth-token";

describe("useAuth", () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.resetAllMocks();
    global.fetch = jest.fn();
  });

  it("returns a stored token without requesting a new challenge", async () => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, "cached-token");
    const { result } = renderHook(() => useAuth());

    let token = "";
    await act(async () => {
      token = await result.current.getToken("GACHEDPUBLICKEY");
    });

    expect(token).toBe("cached-token");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(signMessage).not.toHaveBeenCalled();
    expect(result.current.isAuthenticating).toBe(false);
  });

  it("signs a challenge, verifies it, and stores the returned token", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nonce: "nonce-123" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: "fresh-token" }),
      });
    (signMessage as jest.Mock).mockResolvedValue({
      signedMessage: "signed-nonce",
    });

    const { result } = renderHook(() => useAuth());

    let token = "";
    await act(async () => {
      token = await result.current.getToken("GNEWPUBLICKEY");
    });

    expect(token).toBe("fresh-token");
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "http://localhost:4000/auth/challenge?address=GNEWPUBLICKEY",
    );
    expect(signMessage).toHaveBeenCalledWith("nonce-123", { address: "GNEWPUBLICKEY" });
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4000/auth/verify",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          address: "GNEWPUBLICKEY",
          signature: "signed-nonce",
          nonce: "nonce-123",
        }),
      }),
    );
    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBe("fresh-token");
    expect(result.current.isAuthenticating).toBe(false);
  });

  it("clears the cached token", () => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, "stale-token");
    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.clearToken();
    });

    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });
});
