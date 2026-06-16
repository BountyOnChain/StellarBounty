import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import Navbar from "./Navbar";

jest.mock("../../components/ConnectWalletButton", () => ({
  ConnectWalletButton: () => (
    <button type="button" aria-label="Connect wallet">
      Connect wallet
    </button>
  ),
}));

describe("Navbar accessibility", () => {
  it("has no axe violations", async () => {
    const { container } = render(<Navbar />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it("labels the mobile menu toggle for screen readers", () => {
    render(<Navbar />);

    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
  });
});
