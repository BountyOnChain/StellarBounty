import { act, fireEvent, render, screen } from "@testing-library/react";
import BountySearchInput from "./BountySearchInput";

const replace = jest.fn();
let currentParams = "";

jest.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(currentParams),
}));

const counts = { open: 2, in_progress: 3, completed: 4, cancelled: 5 };

describe("BountySearchInput", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    replace.mockReset();
    currentParams = "";
  });

  afterEach(() => jest.useRealTimers());

  it("does not update the URL before 300ms", () => {
    render(<BountySearchInput initialSearch="" statusCounts={counts} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "wallet" } });

    act(() => jest.advanceTimersByTime(299));
    expect(replace).not.toHaveBeenCalled();
  });

  it("updates once after the final keystroke", () => {
    render(<BountySearchInput initialSearch="" statusCounts={counts} />);
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "wal" } });
    act(() => jest.advanceTimersByTime(200));
    fireEvent.change(input, { target: { value: "wallet" } });

    act(() => jest.advanceTimersByTime(300));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/?q=wallet");
  });

  it("preserves existing filters and resets the page when the search changes", () => {
    currentParams = "search=old&sort=highest_reward&status=completed&limit=50&page=3";
    render(<BountySearchInput initialSearch="old" statusCounts={counts} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "new" } });

    act(() => jest.advanceTimersByTime(300));
    expect(replace).toHaveBeenCalledWith("/?sort=highest_reward&status=completed&limit=50&q=new");
  });

  it("accepts legacy search URLs without rewriting them", () => {
    currentParams = "search=legacy";
    render(<BountySearchInput initialSearch="legacy" statusCounts={counts} />);

    expect(screen.getByRole("searchbox")).toHaveValue("legacy");
    act(() => jest.advanceTimersByTime(300));
    expect(replace).not.toHaveBeenCalled();
  });

  it("does not let an older internal navigation overwrite newer typed text", () => {
    const { rerender } = render(<BountySearchInput initialSearch="" statusCounts={counts} />);
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "old" } });
    act(() => jest.advanceTimersByTime(300));
    expect(replace).toHaveBeenLastCalledWith("/?q=old");

    fireEvent.change(input, { target: { value: "newer" } });
    currentParams = "q=old";
    rerender(<BountySearchInput initialSearch="old" statusCounts={counts} />);

    expect(input).toHaveValue("newer");
    act(() => jest.advanceTimersByTime(300));
    expect(replace).toHaveBeenLastCalledWith("/?q=newer");
  });

  it("keeps newer text when overlapping internal navigations complete out of order", () => {
    const { rerender } = render(<BountySearchInput initialSearch="" statusCounts={counts} />);
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "old" } });
    act(() => jest.advanceTimersByTime(300));
    expect(replace).toHaveBeenLastCalledWith("/?q=old");

    fireEvent.change(input, { target: { value: "newer" } });
    act(() => jest.advanceTimersByTime(300));
    expect(replace).toHaveBeenLastCalledWith("/?q=newer");

    currentParams = "q=old";
    rerender(<BountySearchInput initialSearch="old" statusCounts={counts} />);
    expect(input).toHaveValue("newer");

    currentParams = "q=newer";
    rerender(<BountySearchInput initialSearch="newer" statusCounts={counts} />);
    expect(input).toHaveValue("newer");
  });

  it("updates the input when browser back or forward changes q", () => {
    currentParams = "q=latest";
    const { rerender } = render(<BountySearchInput initialSearch="latest" statusCounts={counts} />);

    currentParams = "q=previous";
    rerender(<BountySearchInput initialSearch="previous" statusCounts={counts} />);

    expect(screen.getByRole("searchbox")).toHaveValue("previous");
  });

  it("does not replace an externally synchronized URL with the previous value", () => {
    currentParams = "q=wallet";
    const { rerender } = render(<BountySearchInput initialSearch="wallet" statusCounts={counts} />);

    currentParams = "q=stellar";
    rerender(<BountySearchInput initialSearch="stellar" statusCounts={counts} />);
    act(() => jest.advanceTimersByTime(300));

    expect(screen.getByRole("searchbox")).toHaveValue("stellar");
    expect(replace).not.toHaveBeenCalled();
  });

  it("synchronizes legacy search values from browser navigation", () => {
    currentParams = "q=wallet";
    const { rerender } = render(<BountySearchInput initialSearch="wallet" statusCounts={counts} />);

    currentParams = "search=legacy";
    rerender(<BountySearchInput initialSearch="legacy" statusCounts={counts} />);
    act(() => jest.advanceTimersByTime(300));

    expect(screen.getByRole("searchbox")).toHaveValue("legacy");
    expect(replace).not.toHaveBeenCalled();
  });

  it("renders counts for every bounty status", () => {
    render(<BountySearchInput initialSearch="" statusCounts={counts} />);

    expect(screen.getByText("Open: 2")).toBeVisible();
    expect(screen.getByText("In progress: 3")).toBeVisible();
    expect(screen.getByText("Completed: 4")).toBeVisible();
    expect(screen.getByText("Cancelled: 5")).toBeVisible();
  });
});
