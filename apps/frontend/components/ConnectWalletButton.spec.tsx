import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { ConnectWalletButton } from "./ConnectWalletButton";

const mockUseWallet = jest.fn();

jest.mock("./WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

describe("ConnectWalletButton accessibility", () => {
  beforeEach(() => {
    mockUseWallet.mockReturnValue({
      publicKey: null,
      targetNetwork: "TESTNET",
      freighterNetwork: null,
      isConnecting: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
    });
  });

  it("has no axe violations when disconnected", async () => {
    const { container } = render(<ConnectWalletButton />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it("has no axe violations when connected", async () => {
    mockUseWallet.mockReturnValue({
      publicKey: "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMN",
      targetNetwork: "TESTNET",
      freighterNetwork: "TESTNET",
      isConnecting: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
    });

    const { container } = render(<ConnectWalletButton />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it("provides an accessible name for the connect action", () => {
    render(<ConnectWalletButton />);

    expect(screen.getByRole("button", { name: "Connect wallet" })).toBeInTheDocument();
  });

  it("provides an accessible name for the disconnect action", () => {
    mockUseWallet.mockReturnValue({
      publicKey: "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMN",
      targetNetwork: "TESTNET",
      freighterNetwork: "TESTNET",
      isConnecting: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
    });

    render(<ConnectWalletButton />);

    expect(screen.getByRole("button", { name: "Disconnect wallet" })).toBeInTheDocument();
  });
});
