import { render, screen, waitFor } from "@testing-library/react";
import { useFetch } from "./use-fetch";

function FetchProbe({ enabled = true }: { enabled?: boolean }) {
  const { data, loading, error } = useFetch<{ value: string }>("/api/test", { enabled });

  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="value">{data?.value ?? ""}</span>
      <span data-testid="error">{error?.message ?? ""}</span>
    </div>
  );
}

describe("useFetch", () => {
  let fetchMock: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
    global.fetch = fetchMock;
  });

  it("returns loading while fetching and data after success", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ value: "loaded" }),
    } as Response);

    render(<FetchProbe />);

    expect(screen.getByTestId("loading").textContent).toBe("true");
    await waitFor(() => expect(screen.getByTestId("value").textContent).toBe("loaded"));
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });

  it("aborts the request on cleanup", () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((_, init) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    });

    const { unmount } = render(<FetchProbe />);

    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("does not fetch when disabled", () => {
    render(<FetchProbe enabled={false} />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });
});
