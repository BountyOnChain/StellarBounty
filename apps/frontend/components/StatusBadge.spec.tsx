import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders pending status", () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText("pending")).toBeInTheDocument();
  });

  it("renders approved status", () => {
    render(<StatusBadge status="approved" />);
    expect(screen.getByText("approved")).toBeInTheDocument();
  });

  it("renders open status", () => {
    render(<StatusBadge status="open" />);
    expect(screen.getByText("open")).toBeInTheDocument();
  });

  it("renders cancelled status with theme-aware classes", () => {
    const { container } = render(<StatusBadge status="cancelled" />);
    const badge = container.firstChild;
    expect(badge).toHaveClass("bg-slate-100");
    expect(badge).toHaveClass("text-slate-700");
  });

  it("renders in_progress status with underscores replaced by spaces", () => {
    render(<StatusBadge status="in_progress" />);
    expect(screen.getByText("in progress")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<StatusBadge status="open" className="extra-class" />);
    expect(screen.getByText("open")).toHaveClass("extra-class");
  });
});