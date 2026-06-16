import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import BountyCard from "./BountyCard";

describe("BountyCard accessibility", () => {
  const bounty = {
    id: "bounty-1",
    title: "Build a Soroban escrow contract",
    reward: 500,
    deadline: "2026-12-31T00:00:00.000Z",
    status: "open",
  };

  it("has no axe violations", async () => {
    const { container } = render(<BountyCard bounty={bounty} />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it("exposes an accessible link name from the bounty title", () => {
    render(<BountyCard bounty={bounty} />);

    expect(
      document.querySelector('a[href="/bounties/bounty-1"]'),
    ).toHaveAccessibleName("View bounty: Build a Soroban escrow contract");
  });
});
