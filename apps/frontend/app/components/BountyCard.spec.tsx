import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import BountyCard from "./BountyCard";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("BountyCard", () => {
  it("renders reward, deadline, status, and detail link", () => {
    render(
      <BountyCard
        bounty={{
          id: "bounty-1",
          title: "Build the payout dashboard",
          reward: 1500,
          deadline: "2026-01-15T00:00:00.000Z",
          status: "in_review",
        }}
      />,
    );

    const link = screen.getByRole("link", { name: /build the payout dashboard/i });
    expect(link).toHaveAttribute("href", "/bounties/bounty-1");
    expect(screen.getByText("1,500 XLM")).toBeInTheDocument();
    expect(screen.getByText("Jan 15, 2026")).toBeInTheDocument();
    expect(screen.getByText("in review")).toBeInTheDocument();
  });

  it("renders fallback labels for missing optional values", () => {
    render(
      <BountyCard
        bounty={{
          id: 42,
          title: "Document the bounty API",
          reward: null,
          deadline: null,
          status: null,
        }}
      />,
    );

    expect(screen.getByRole("link", { name: /document the bounty api/i })).toHaveAttribute(
      "href",
      "/bounties/42",
    );
    expect(screen.getByText("Reward TBD")).toBeInTheDocument();
    expect(screen.getByText("No deadline")).toBeInTheDocument();
    expect(screen.getByText("open")).toBeInTheDocument();
  });
});
