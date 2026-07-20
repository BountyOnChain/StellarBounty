import { act, render, screen } from "@testing-library/react";
import { useDebouncedValue } from "./useDebouncedValue";

function DebouncedValue({ value }: { value: string }) {
  return <output>{useDebouncedValue(value, 300)}</output>;
}

describe("useDebouncedValue", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("waits for the configured delay before updating", () => {
    const { rerender } = render(<DebouncedValue value="first" />);
    rerender(<DebouncedValue value="second" />);

    act(() => jest.advanceTimersByTime(299));
    expect(screen.getByRole("status")).toHaveTextContent("first");

    act(() => jest.advanceTimersByTime(1));
    expect(screen.getByRole("status")).toHaveTextContent("second");
  });

  it("only emits the final value when changes occur during the delay", () => {
    const { rerender } = render(<DebouncedValue value="a" />);
    rerender(<DebouncedValue value="ab" />);
    act(() => jest.advanceTimersByTime(200));
    rerender(<DebouncedValue value="abc" />);

    act(() => jest.advanceTimersByTime(299));
    expect(screen.getByRole("status")).toHaveTextContent("a");

    act(() => jest.advanceTimersByTime(1));
    expect(screen.getByRole("status")).toHaveTextContent("abc");
  });
});
