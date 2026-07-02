import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import Navbar from "./Navbar";
import { ThemeProvider } from "../../components/ThemeProvider";
jest.mock("../../components/ConnectWalletButton", () => ({
  ConnectWalletButton: () => (
    <button type="button" aria-label="Connect wallet">
      Connect wallet
    </button>
  ),
}));

describe("Navbar accessibility", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <ThemeProvider>
        <Navbar />
      </ThemeProvider>
    );
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it("labels the mobile menu toggle for screen readers", () => {
    render(
      <ThemeProvider>
        <Navbar />
      </ThemeProvider>
    );

    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
  });
});
