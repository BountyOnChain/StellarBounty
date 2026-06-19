import { render, waitFor } from "@testing-library/react";
import { WalletProvider, useWallet } from "./WalletContext";

jest.mock("@stellar/freighter-api", () => ({
  __esModule: true,
  getPublicKey: jest.fn(),
  getNetworkDetails: jest.fn(),
  isConnected: jest.fn(),
  signMessage: jest.fn(),
}));

const STORAGE_KEY = "stellar-bounty.wallet";

function TestConsumer() {
  const ctx = useWallet();
  return (
    <div data-testid="state">
      {JSON.stringify({
        publicKey: ctx.publicKey,
        freighterNetwork: ctx.freighterNetwork,
        targetNetwork: ctx.targetNetwork,
        isConnecting: ctx.isConnecting,
        error: ctx.error,
        hasConnect: typeof ctx.connect === "function",
        hasDisconnect: typeof ctx.disconnect === "function",
      })}
    </div>
  );
}

function renderWithProvider() {
  return render(
    <WalletProvider>
      <TestConsumer />
    </WalletProvider>
  );
}

function readState(container: HTMLElement) {
  const raw = container.querySelector('[data-testid="state"]')?.textContent ?? "{}";
  return JSON.parse(raw);
}

describe("WalletContext — basic state", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts in a disconnected state with a default target network", async () => {
    const { container } = renderWithProvider();
    await waitFor(() => {
      const s = readState(container);
      expect(s.publicKey).toBeNull();
      expect(s.freighterNetwork).toBeNull();
      expect(s.targetNetwork).toBe("TESTNET");
      expect(s.isConnecting).toBe(false);
      expect(s.error).toBeNull();
      expect(s.hasConnect).toBe(true);
      expect(s.hasDisconnect).toBe(true);
    });
  });

  it("rehydrates a saved wallet from localStorage on mount", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ publicKey: "GSAVED", freighterNetwork: "TESTNET" })
    );

    const { container } = renderWithProvider();
    await waitFor(() => {
      expect(readState(container).publicKey).toBe("GSAVED");
    });
  });

  it("ignores malformed stored wallets without throwing", async () => {
    window.localStorage.setItem(STORAGE_KEY, "{not-json");

    const { container } = renderWithProvider();
    await waitFor(() => {
      expect(readState(container).publicKey).toBeNull();
    });
  });
});

describe("useWallet hook", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("throws a clear error when used outside a WalletProvider", () => {
    // Suppress the expected React error log for this negative test
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    function Naked() {
      useWallet();
      return null;
    }
    expect(() => render(<Naked />)).toThrow(/useWallet must be used inside WalletProvider/i);
    spy.mockRestore();
  });
});

// The connect() / disconnect() flows depend on the @stellar/freighter-api
// dynamic import. Those are covered by manual browser smoke tests and the
// e2e suite. A follow-up PR will add the asynchronous connect path once
// the React 18 + jsdom 29 act() environment is stabilized for the
// dynamic-import path.
describe.skip("WalletContext — connect flow (deferred to follow-up PR)", () => {
  it("connects successfully when the wallet is on the same network", async () => {
    // deferred
  });
});
