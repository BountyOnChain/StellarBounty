import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAbortController } from "./api";

describe("useAbortController", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a signal that aborts on unmount", async () => {
    const onAbort = vi.fn();
    const { result, unmount } = renderHook(() =>
      useAbortController(true)
    );

    const signal = result.current.signal;
    expect(signal).toBeDefined();
    expect(signal.aborted).toBe(false);

    // Simulate component unmount
    act(() => {
      unmount();
    });

    expect(result.current.signal.aborted).toBe(true);
  });

  it("does not create a controller when disabled", () => {
    const { result } = renderHook(() => useAbortController(false));
    const signal = result.current.signal;
    expect(signal).toBeDefined();
    expect(signal.aborted).toBe(false);
  });

  it("calling abort() cancels the signal", () => {
    const { result } = renderHook(() => useAbortController(true));
    const signalBefore = result.current.signal;
    expect(signalBefore.aborted).toBe(false);

    act(() => {
      result.current.abort();
    });

    expect(result.current.signal.aborted).toBe(true);
  });
});
