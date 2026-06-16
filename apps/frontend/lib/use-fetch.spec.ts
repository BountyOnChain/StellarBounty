import { isAbortError } from "./use-fetch";

describe("useFetch helpers", () => {
  it("identifies abort errors so cancelled requests can be ignored", () => {
    const error = new Error("The operation was aborted.");
    error.name = "AbortError";

    expect(isAbortError(error)).toBe(true);
    expect(isAbortError(new Error("Network failed."))).toBe(false);
  });
});
