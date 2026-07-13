import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { ConnectWalletButton } from "./ConnectWalletButton";
import { WalletProvider } from "./WalletContext";

jest.mock("@stellar/freighter-api", () => ({
  __esModule: true,
  getPublicKey: jest.fn(),
  getNetworkDetails: jest.fn(),
  isConnected: jest.fn(),
  signMessage: jest.fn(),
}));

describe("ConnectWalletButton accessibility", () => {
  it("has no detectable a11y violations", async () => {
    const { container } = render(
      <WalletProvider>
        <ConnectWalletButton />
      </WalletProvider>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
