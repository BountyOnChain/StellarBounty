import { render, screen } from "@testing-library/react";
import BountyCard, { type BountyCardData } from "./BountyCard";

function renderCard(bounty: Partial<BountyCardData>) {
  return render(<BountyCard bounty={bounty as BountyCardData} />);
}

describe("BountyCard", () => {
  it("renders the bounty title", () => {
    renderCard({ id: "42", title: "Fix the README typo" });
    expect(
      screen.getByRole("heading", { name: /fix the readme typo/i })
    ).toBeInTheDocument();
  });

  it("links to the bounty detail page using the bounty id", () => {
    renderCard({ id: 7, title: "Anything" });
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/bounties/7");
  });

  it("formats a numeric reward with thousands separators and the XLM suffix", () => {
    renderCard({ id: "1", title: "x", reward: 12345 });
    expect(screen.getByText("12,345 XLM")).toBeInTheDocument();
  });

  it("renders a string reward verbatim", () => {
    renderCard({ id: "1", title: "x", reward: "0.5 XLM" });
    expect(screen.getByText("0.5 XLM")).toBeInTheDocument();
  });

  it("falls back to 'Reward TBD' when the reward is missing", () => {
    renderCard({ id: "1", title: "x" });
    expect(screen.getByText(/reward tbd/i)).toBeInTheDocument();
  });

  it("falls back to 'Reward TBD' when the reward is null or empty string", () => {
    const { rerender } = renderCard({ id: "1", title: "x", reward: null });
    expect(screen.getByText(/reward tbd/i)).toBeInTheDocument();
    rerender(<BountyCard bounty={{ id: "1", title: "x", reward: "" }} />);
    expect(screen.getByText(/reward tbd/i)).toBeInTheDocument();
  });

  it("falls back to 'No deadline' when the deadline is missing or null", () => {
    const { rerender } = renderCard({ id: "1", title: "x" });
    expect(screen.getByText(/no deadline/i)).toBeInTheDocument();
    rerender(<BountyCard bounty={{ id: "1", title: "x", deadline: null }} />);
    expect(screen.getByText(/no deadline/i)).toBeInTheDocument();
  });

  it("renders a valid deadline as an en-US short date", () => {
    renderCard({ id: "1", title: "x", deadline: "2027-03-14T00:00:00Z" });
    // Intl.DateTimeFormat output for the en locale in jsdom:
    // "Mar 14, 2027" (UTC). We assert the year + the formatted month/day
    // pattern loosely to stay robust against the runtime timezone.
    const text = screen.getByText(/2027/).textContent ?? "";
    expect(text).toMatch(/2027/);
    expect(text).toMatch(/Mar/);
  });

  it("falls back to the raw deadline string when the date is unparseable", () => {
    renderCard({ id: "1", title: "x", deadline: "not-a-date" });
    expect(screen.getByText("not-a-date")).toBeInTheDocument();
  });

  it("defaults the status to 'open' when not provided", () => {
    renderCard({ id: "1", title: "x" });
    expect(screen.getByText(/open/i)).toBeInTheDocument();
  });

  it("renders the provided status and replaces underscores with spaces", () => {
    renderCard({ id: "1", title: "x", status: "in_progress" });
    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
  });
});
