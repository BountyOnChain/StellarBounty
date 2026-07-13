import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import Navbar from "./Navbar";
import { ThemeProvider } from "../../components/ThemeProvider";
import { WalletProvider } from "../../components/WalletContext";

jest.mock("next/navigation", () => ({ usePathname: () => "/" }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
jest.mock("@stellar/freighter-api", () => ({
  __esModule: true,
  getPublicKey: jest.fn(),
  getNetworkDetails: jest.fn(),
  isConnected: jest.fn(),
  signMessage: jest.fn(),
}));

describe("Navbar accessibility", () => {
  it("has no detectable a11y violations", async () => {
    const { container } = render(
      <ThemeProvider>
        <WalletProvider>
          <Navbar />
        </WalletProvider>
      </ThemeProvider>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
